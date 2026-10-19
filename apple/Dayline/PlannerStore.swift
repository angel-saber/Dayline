import SwiftUI
import CoreData
import CloudKit
import Combine
import DaylineCore

@MainActor
final class PlannerStore: ObservableObject {
    @Published private(set) var days: [String: [PlannerNote]] = [:]
    @Published private(set) var isReady = false
    @Published private(set) var saveDescription = "Opening your notes…"
    @Published var error: String?
    @Published var message: String?
    @Published private(set) var canUndo = false
    @Published var cloudDescription = "Stored on this device"
    @Published var settings = PlannerSettings() {
        didSet {
            guard (1...1440).contains(settings.interval) else { settings = oldValue; return }
            do { UserDefaults.standard.set(try JSONEncoder().encode(settings), forKey: "dayline.settings") }
            catch { self.error = error.localizedDescription }
        }
    }

    static var cloudBuild: Bool {
        #if DAYLINE_ICLOUD
        true
        #else
        false
        #endif
    }
    var cloudEnabledAtLaunch: Bool
    var cloudRequested: Bool { UserDefaults.standard.bool(forKey: "dayline.icloud") }
    let container: NSPersistentCloudKitContainer
    private var subscriptions = Set<AnyCancellable>()
    private var undoDay: (key: String, notes: [PlannerNote])?

    init() {
        cloudEnabledAtLaunch = Self.cloudBuild && UserDefaults.standard.bool(forKey: "dayline.icloud")
        container = NSPersistentCloudKitContainer(name: "Dayline", managedObjectModel: DaylineModel.make())
        if let data = UserDefaults.standard.data(forKey: "dayline.settings"),
           let saved = try? JSONDecoder().decode(PlannerSettings.self, from: data),
           (1...1440).contains(saved.interval) { settings = saved }
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy

        NotificationCenter.default.publisher(for: .NSManagedObjectContextObjectsDidChange, object: container.viewContext)
            .debounce(for: .milliseconds(100), scheduler: RunLoop.main)
            .sink { [weak self] _ in
                guard let self, !self.container.viewContext.hasChanges, self.isReady else { return }
                self.refresh()
            }.store(in: &subscriptions)
        NotificationCenter.default.publisher(for: NSPersistentCloudKitContainer.eventChangedNotification)
            .receive(on: RunLoop.main)
            .sink { [weak self] notification in
                guard let self, self.cloudEnabledAtLaunch,
                      let event = notification.userInfo?[NSPersistentCloudKitContainer.eventNotificationUserInfoKey] as? NSPersistentCloudKitContainer.Event else { return }
                if let error = event.error {
                    self.cloudDescription = "iCloud needs attention: \(error.localizedDescription). Local notes are kept."
                } else if event.endDate == nil {
                    self.cloudDescription = "iCloud transfer in progress…"
                } else if event.succeeded {
                    self.cloudDescription = "Last iCloud transfer: \(event.endDate!.formatted(date: .omitted, time: .shortened))"
                }
            }.store(in: &subscriptions)
        NotificationCenter.default.publisher(for: .CKAccountChanged)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in Task { await self?.checkCloudAccount() } }
            .store(in: &subscriptions)
        open()
    }

    func open() {
        guard !isReady else { return }
        do {
            let folder = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            let description = NSPersistentStoreDescription(url: folder.appendingPathComponent("Dayline.sqlite"))
            description.shouldMigrateStoreAutomatically = true
            description.shouldInferMappingModelAutomatically = true
            description.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)
            description.setOption(true as NSNumber, forKey: NSPersistentStoreRemoteChangeNotificationPostOptionKey)
            if cloudEnabledAtLaunch {
                guard let identifier = Bundle.main.object(forInfoDictionaryKey: "DaylineCloudContainer") as? String,
                      !identifier.isEmpty else { throw NSError(domain: "Dayline", code: 1, userInfo: [NSLocalizedDescriptionKey: "The private iCloud container is not configured."]) }
                let options = NSPersistentCloudKitContainerOptions(containerIdentifier: identifier)
                options.databaseScope = .private
                description.cloudKitContainerOptions = options
            } else {
                description.cloudKitContainerOptions = nil
            }
            container.persistentStoreDescriptions = [description]
            container.loadPersistentStores { [weak self] _, failure in
                Task { @MainActor in
                    guard let self else { return }
                    if let failure {
                        self.error = "Your saved notes could not be opened. No temporary replacement store was created. \(failure.localizedDescription)"
                        self.saveDescription = "Notes are not available"
                        return
                    }
                    self.isReady = true
                    self.refresh()
                    await self.checkCloudAccount()
                }
            }
        } catch {
            self.error = error.localizedDescription
            saveDescription = "Could not open storage"
        }
    }

    func checkCloudAccount() async {
        guard cloudEnabledAtLaunch else { cloudDescription = "Stored on this device"; return }
        guard let identifier = Bundle.main.object(forInfoDictionaryKey: "DaylineCloudContainer") as? String else { return }
        do {
            switch try await CKContainer(identifier: identifier).accountStatus() {
            case .available: cloudDescription = "iCloud available. Changes transfer automatically when the system allows."
            case .noAccount: cloudDescription = "Sign into iCloud in device Settings to sync. Notes still save here."
            case .restricted: cloudDescription = "iCloud is restricted on this device. Notes still save here."
            case .couldNotDetermine, .temporarilyUnavailable: cloudDescription = "iCloud is temporarily unavailable. Notes still save here."
            @unknown default: cloudDescription = "iCloud status is unavailable. Notes still save here."
            }
        } catch { cloudDescription = "iCloud unavailable: \(error.localizedDescription). Notes still save here." }
    }

    private func records(day: String? = nil, includeTrashed: Bool = false) throws -> [NoteRecord] {
        let request = NSFetchRequest<NoteRecord>(entityName: "NoteRecord")
        var predicates: [NSPredicate] = []
        if let day { predicates.append(NSPredicate(format: "day == %@", day)) }
        if !includeTrashed { predicates.append(NSPredicate(format: "trashed == NO")) }
        request.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        request.sortDescriptors = [NSSortDescriptor(key: "minute", ascending: true), NSSortDescriptor(key: "noteID", ascending: true)]
        return try container.viewContext.fetch(request)
    }

    func refresh() {
        guard isReady else { return }
        do {
            let records = try records()
            var rebuilt: [String: [PlannerNote]] = [:]
            for record in records where !record.noteID.isEmpty && Planner.date(for: record.day) != nil {
                // The persistent object identity disambiguates records if two
                // devices independently import an identical backup while offline.
                let key = record.objectID.uriRepresentation().absoluteString
                rebuilt[record.day, default: []].append(PlannerNote(id: key, text: record.text, minute: Int(record.minute), done: record.done))
            }
            if days != rebuilt { undoDay = nil; canUndo = false }
            days = rebuilt
            saveDescription = "Saved on this device"
        } catch { self.error = error.localizedDescription; saveDescription = "Could not read notes" }
    }

    func notes(on date: Date) -> [PlannerNote] { days[Planner.dayKey(date)] ?? [] }

    private func transaction(_ body: () throws -> Void) -> Bool {
        guard isReady else { return false }
        do {
            try body()
            if container.viewContext.hasChanges { try container.viewContext.save() }
            refresh()
            return true
        } catch {
            container.viewContext.rollback()
            self.error = "This change could not be saved. \(error.localizedDescription)"
            saveDescription = "Change not saved"
            return false
        }
    }

    private func find(_ id: String) -> NoteRecord? {
        guard let url = URL(string: id), let objectID = container.persistentStoreCoordinator.managedObjectID(forURIRepresentation: url) else { return nil }
        return (try? container.viewContext.existingObject(with: objectID)) as? NoteRecord
    }

    @discardableResult
    func edit(id: String?, date: Date, minute: Int, text: String) -> String? {
        guard isReady else { return nil }
        undoDay = nil; canUndo = false
        var result = id
        let saved = transaction {
            if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                if let id, let record = find(id) { record.trashed = true; record.modifiedAt = Date() }
                return
            }
            let record = id.flatMap(find) ?? NoteRecord(context: container.viewContext)
            if record.noteID.isEmpty { record.noteID = UUID().uuidString }
            record.day = Planner.dayKey(date); record.minute = Int64(minute)
            record.text = text; record.trashed = false; record.modifiedAt = Date()
            try container.viewContext.obtainPermanentIDs(for: [record])
            result = record.objectID.uriRepresentation().absoluteString
        }
        return saved ? result : id
    }

    func toggle(_ note: PlannerNote, date: Date) {
        let before = notes(on: date)
        if transaction({ if let record = find(note.id) { record.done.toggle(); record.modifiedAt = Date() } }) {
            undoDay = (Planner.dayKey(date), before); canUndo = true
        }
    }

    func remove(_ note: PlannerNote, date: Date) {
        let before = notes(on: date)
        if transaction({ if let record = find(note.id) { record.trashed = true; record.modifiedAt = Date() } }) {
            undoDay = (Planner.dayKey(date), before); canUndo = true
        }
    }

    func move(_ id: String, date: Date, to minute: Int) {
        let before = notes(on: date)
        let moved = Planner.move(before, id: id, to: minute, interval: settings.interval)
        guard moved != before else { return }
        if transaction({
            for note in moved { if let record = find(note.id) { record.minute = Int64(note.minute); record.modifiedAt = Date() } }
        }) { undoDay = (Planner.dayKey(date), before); canUndo = true }
    }

    func undo() {
        guard let previous = undoDay else { return }
        if transaction({
            let wanted = Set(previous.notes.map(\.id))
            for record in try records(day: previous.key) where !wanted.contains(record.objectID.uriRepresentation().absoluteString) {
                record.trashed = true; record.modifiedAt = Date()
            }
            for note in previous.notes {
                if let record = find(note.id) {
                    record.text = note.text; record.minute = Int64(note.minute); record.done = note.done
                    record.trashed = false; record.modifiedAt = Date()
                }
            }
        }) { undoDay = nil; canUndo = false }
    }

    func backup() throws -> Data {
        guard isReady else { throw CocoaError(.fileReadUnknown) }
        var exported: [String: [PlannerNote]] = [:]
        for record in try records() {
            var id = record.noteID
            if exported[record.day, default: []].contains(where: { $0.id == id }) { id = UUID().uuidString }
            exported[record.day, default: []].append(PlannerNote(id: id, text: record.text, minute: Int(record.minute), done: record.done))
        }
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(PlannerBackup(days: exported, settings: settings))
    }

    func importBackup(_ backup: PlannerBackup) {
        guard (try? backup.validated()) != nil else { error = PlannerError.backup.localizedDescription; return }
        // Additive import avoids deleting cloud notes from another device.
        if transaction({
            for (day, notes) in backup.days {
                var existing = try records(day: day)
                for note in notes {
                    if existing.contains(where: { $0.text == note.text && $0.minute == Int64(note.minute) && $0.done == note.done }) { continue }
                    let record = NoteRecord(context: container.viewContext)
                    record.noteID = UUID().uuidString; record.day = day; record.text = note.text
                    record.minute = Int64(note.minute); record.done = note.done
                    record.trashed = false; record.modifiedAt = Date(); existing.append(record)
                }
            }
        }) {
            undoDay = nil; canUndo = false
            message = "Backup notes added. Existing notes were kept. Device settings were not changed."
        }
    }
}
