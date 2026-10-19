import Foundation

public struct PlannerNote: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var text: String
    public var minute: Int
    public var done: Bool

    public init(id: String = UUID().uuidString, text: String, minute: Int, done: Bool = false) {
        self.id = id
        self.text = text
        self.minute = minute
        self.done = done
    }
}

public struct PlannerSettings: Codable, Equatable, Sendable {
    public var interval: Int = 60
    public var clock: String = "12"
    public var notifications: Bool = false
    public var sound: Bool = false
    public init() {}
}

public enum PlannerError: LocalizedError {
    case interval, backup, day, entry
    public var errorDescription: String? {
        switch self {
        case .interval: return "Choose a whole number from 1 to 1440 minutes."
        case .backup: return "This file is not a supported Dayline backup."
        case .day: return "The backup contains an invalid calendar day."
        case .entry: return "The backup contains an invalid or duplicate note."
        }
    }
}

public enum Planner {
    public static var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = .current
        return value
    }

    public static func dayKey(_ date: Date) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year!, components.month!, components.day!)
    }

    public static func date(for key: String) -> Date? {
        let pieces = key.split(separator: "-", omittingEmptySubsequences: false)
        guard pieces.count == 3, pieces[0].count == 4,
              pieces[1].count == 2, pieces[2].count == 2,
              let y = Int(pieces[0]), let m = Int(pieces[1]), let d = Int(pieces[2]), y >= 1,
              let date = calendar.date(from: DateComponents(year: y, month: m, day: d, hour: 12)),
              dayKey(date) == key else { return nil }
        return date
    }

    public static func slots(interval: Int) throws -> [Int] {
        guard (1...1440).contains(interval) else { throw PlannerError.interval }
        return Array(stride(from: 0, to: 1440, by: interval))
    }

    public static func bucket(_ minute: Int, interval: Int) -> Int {
        minute / max(1, interval) * max(1, interval)
    }

    public static func label(_ minute: Int, clock: String = "12") -> String {
        if minute == 1440 { return clock == "24" ? "24:00" : "12:00 AM" }
        let hour = minute / 60
        if clock == "24" { return String(format: "%02d:%02d", hour, minute % 60) }
        return String(format: "%d:%02d %@", hour % 12 == 0 ? 12 : hour % 12, minute % 60, hour < 12 ? "AM" : "PM")
    }

    public static func move(_ notes: [PlannerNote], id: String, to target: Int, interval: Int) -> [PlannerNote] {
        guard let starts = try? slots(interval: interval), starts.contains(target),
              let moved = notes.first(where: { $0.id == id }) else { return notes }
        let source = bucket(moved.minute, interval: interval)
        guard source != target else { return notes }
        return notes.map { original in
            var note = original
            let slot = bucket(note.minute, interval: interval)
            if note.id == id { note.minute = target }
            else if source < target && slot > source && slot <= target { note.minute = slot - interval }
            else if source > target && slot >= target && slot < source { note.minute = slot + interval }
            return note
        }.sorted { $0.minute < $1.minute }
    }

    public static func reminders(days: [String: [PlannerNote]], interval: Int, after now: Date, limit: Int = 60) -> [PlannedReminder] {
        guard (1...1440).contains(interval), limit > 0 else { return [] }
        var result: [PlannedReminder] = []
        for (key, notes) in days {
            guard let day = date(for: key) else { continue }
            let grouped = Dictionary(grouping: notes.filter { !$0.done && !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
                bucket($0.minute, interval: interval)
            }
            for (minute, entries) in grouped {
                guard (0..<1440).contains(minute) else { continue }
                var components = calendar.dateComponents([.year, .month, .day], from: day)
                components.hour = minute / 60; components.minute = minute % 60; components.second = 0
                guard let fire = calendar.date(from: components), fire > now,
                      dayKey(fire) == key, calendar.component(.hour, from: fire) == minute / 60,
                      calendar.component(.minute, from: fire) == minute % 60 else { continue }
                let text = entries.sorted { $0.id < $1.id }.map(\.text).joined(separator: "\n")
                result.append(PlannedReminder(id: "dayline-\(key)-\(minute)", date: fire, text: String(text.prefix(1000))))
            }
        }
        return Array(result.sorted { $0.date < $1.date }.prefix(limit))
    }
}

public struct PlannedReminder: Equatable, Sendable {
    public let id: String
    public let date: Date
    public let text: String
}

// Compatible with the web prototype's version-1 JSON exports.
public struct PlannerBackup: Codable, Sendable {
    public var version: Int = 1
    public var days: [String: [PlannerNote]]
    public var settings: PlannerSettings

    public init(days: [String: [PlannerNote]], settings: PlannerSettings) {
        self.days = days
        self.settings = settings
    }

    public func validated() throws -> PlannerBackup {
        guard version == 1 else { throw PlannerError.backup }
        _ = try Planner.slots(interval: settings.interval)
        guard settings.clock == "12" || settings.clock == "24" else { throw PlannerError.backup }
        for (day, notes) in days {
            guard Planner.date(for: day) != nil else { throw PlannerError.day }
            var ids = Set<String>()
            for note in notes {
                guard !note.id.isEmpty, (0..<1440).contains(note.minute), ids.insert(note.id).inserted else {
                    throw PlannerError.entry
                }
            }
        }
        return self
    }

    public static func decode(_ data: Data) throws -> PlannerBackup {
        guard data.count <= 10 * 1024 * 1024 else { throw PlannerError.backup }
        return try JSONDecoder().decode(PlannerBackup.self, from: data).validated()
    }
}
