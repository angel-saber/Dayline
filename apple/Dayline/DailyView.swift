import SwiftUI
import UniformTypeIdentifiers
import DaylineCore

private struct EditorRequest: Identifiable {
    let id = UUID()
    let date: Date
    let minute: Int
    let note: PlannerNote?
}

struct NoteDrag: Codable, Transferable {
    let id: String
    let day: String
    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .daylineNote)
    }
}
extension UTType {
    static let daylineNote = UTType(exportedAs: "com.angelsaber.dayline.note")
}

@MainActor
struct DailyView: View {
    @EnvironmentObject private var store: PlannerStore
    @State private var selectedDate = Date()
    @State private var editor: EditorRequest?
    @State private var moving: PlannerNote?
    @State private var highlightedMinute: Int?

    private var notes: [PlannerNote] { store.notes(on: selectedDate) }
    private var slots: [Int] { (try? Planner.slots(interval: store.settings.interval)) ?? [] }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                List {
                    header.listRowBackground(Color.clear).listRowSeparator(.hidden)
                    ForEach(slots, id: \.self) { minute in
                        let entries = notes.filter { Planner.bucket($0.minute, interval: store.settings.interval) == minute }
                        if entries.isEmpty {
                            slotRow(minute: minute, note: nil)
                                .id(minute)
                                .onTapGesture { editor = EditorRequest(date: selectedDate, minute: minute, note: nil) }
                                .dropDestination(for: NoteDrag.self) { payloads, _ in accept(payloads, at: minute) } isTargeted: { target in highlightedMinute = target ? minute : nil }
                        } else {
                            ForEach(entries) { note in
                                slotRow(minute: minute, note: note)
                                    .id(note.id == entries.first?.id ? "slot-\(minute)" : note.id)
                                    .onTapGesture { editor = EditorRequest(date: selectedDate, minute: note.minute, note: note) }
                                    .draggable(NoteDrag(id: note.id, day: Planner.dayKey(selectedDate)))
                                    .dropDestination(for: NoteDrag.self) { payloads, _ in accept(payloads, at: minute) } isTargeted: { target in highlightedMinute = target ? minute : nil }
                                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                        Button { store.toggle(note, date: selectedDate) } label: { Label(note.done ? "Reopen" : "Complete", systemImage: note.done ? "arrow.uturn.backward" : "checkmark") }.tint(DaylineTheme.green)
                                    }
                                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                        Button(role: .destructive) { store.remove(note, date: selectedDate) } label: { Label("Delete", systemImage: "trash") }
                                        Button { moving = note } label: { Label("Move", systemImage: "arrow.up.arrow.down") }.tint(DaylineTheme.green)
                                    }
                                    .contextMenu {
                                        Button(note.done ? "Reopen note" : "Complete note", systemImage: "checkmark.circle") { store.toggle(note, date: selectedDate) }
                                        Button("Move to a time…", systemImage: "arrow.up.arrow.down") { moving = note }
                                        Button("Delete note", systemImage: "trash", role: .destructive) { store.remove(note, date: selectedDate) }
                                    }
                                    .accessibilityAction(named: "Move to another time") { moving = note }
                                    .accessibilityAction(named: note.done ? "Reopen" : "Complete") { store.toggle(note, date: selectedDate) }
                                    .accessibilityAction(named: "Delete") { store.remove(note, date: selectedDate) }
                            }
                        }
                    }
                    Text("A day doesn’t have to be full to be a good one.")
                        .font(.system(.subheadline, design: .serif).italic())
                        .foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.vertical, 24)
                        .listRowSeparator(.hidden).listRowBackground(Color.clear)
                }
                .listStyle(.plain).scrollContentBackground(.hidden).background(DaylineTheme.paper)
                .navigationTitle("dayline.").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button { store.undo() } label: { Image(systemName: "arrow.uturn.backward") }
                            .disabled(!store.canUndo).accessibilityLabel("Undo last completion, deletion, or move")
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Today") {
                            selectedDate = Date()
                            let now = Planner.calendar.dateComponents([.hour, .minute], from: Date())
                            let minute = Planner.bucket((now.hour ?? 0) * 60 + (now.minute ?? 0), interval: store.settings.interval)
                            let empty = !notes.contains { Planner.bucket($0.minute, interval: store.settings.interval) == minute }
                            withAnimation { if empty { proxy.scrollTo(minute, anchor: .center) } else { proxy.scrollTo("slot-\(minute)", anchor: .center) } }
                        }
                    }
                }
                .safeAreaInset(edge: .bottom, spacing: 0) { dateNavigation }
                .sheet(item: $editor) { request in
                    NoteEditor(date: request.date, minute: request.minute, note: request.note)
                }
                .sheet(item: $moving) { note in MoveNoteView(date: selectedDate, note: note) }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 15) {
            Text("YOUR DAY, AT YOUR PACE").font(.caption2.weight(.semibold)).tracking(2).foregroundStyle(DaylineTheme.green)
            Text(selectedDate.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()))
                .font(.system(size: 34, design: .serif)).foregroundStyle(DaylineTheme.ink)
                .accessibilityAddTraits(.isHeader)
            Text("Make a little room for what matters.").font(.subheadline).foregroundStyle(.secondary)
            HStack {
                Text(notes.isEmpty ? "A fresh page for your day" : "\(notes.filter(\.done).count) of \(notes.count) notes completed")
                Spacer()
                Text("\(store.settings.interval) min intervals")
            }.font(.caption).foregroundStyle(.secondary).padding(.top, 10)
            ProgressView(value: notes.isEmpty ? 0 : Double(notes.filter(\.done).count) / Double(notes.count))
                .accessibilityLabel("Completed notes")
            Text("Swipe to complete or delete · Hold a note to move it")
                .font(.caption2).foregroundStyle(.secondary)
        }.padding(.vertical, 20)
    }

    private func slotRow(minute: Int, note: PlannerNote?) -> some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                Text(Planner.label(minute, clock: store.settings.clock)).font(.caption.weight(.medium))
                Text("– \(Planner.label(min(1440, minute + store.settings.interval), clock: store.settings.clock))").font(.system(size: 10))
            }.foregroundStyle(.secondary).frame(width: 77, alignment: .leading).padding(.top, 4)
            if let note {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: note.done ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(note.done ? DaylineTheme.green : Color.secondary.opacity(0.45))
                        .accessibilityHidden(true)
                    Text(note.text).strikethrough(note.done).foregroundStyle(note.done ? Color.secondary : DaylineTheme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "line.3.horizontal").font(.caption2).foregroundStyle(.tertiary).accessibilityHidden(true)
                }.font(.subheadline).padding(14)
                    .background(note.done ? DaylineTheme.green.opacity(0.06) : Color.white, in: RoundedRectangle(cornerRadius: 9))
            } else {
                Label("Add a note", systemImage: "plus").font(.subheadline).foregroundStyle(.secondary.opacity(0.75))
                    .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading).padding(.leading, 14)
            }
        }
        .frame(minHeight: 66).padding(.vertical, 6)
        .contentShape(Rectangle())
        .listRowBackground(highlightedMinute == minute ? DaylineTheme.green.opacity(0.13) : DaylineTheme.paper)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(Planner.label(minute, clock: store.settings.clock)). \(note?.text ?? "Add a note"). \(note?.done == true ? "Completed" : "")")
        .accessibilityAddTraits(.isButton)
    }

    private var dateNavigation: some View {
        HStack {
            Button { changeDay(-1) } label: { Image(systemName: "chevron.left").frame(width: 48, height: 44) }.accessibilityLabel("Previous day")
            Spacer()
            DatePicker("Go to date", selection: $selectedDate, displayedComponents: .date).labelsHidden().datePickerStyle(.compact)
            Spacer()
            Button { changeDay(1) } label: { Image(systemName: "chevron.right").frame(width: 48, height: 44) }.accessibilityLabel("Next day")
        }.padding(.horizontal).padding(.vertical, 6).background(.regularMaterial)
    }

    private func changeDay(_ amount: Int) {
        if let next = Planner.calendar.date(byAdding: .day, value: amount, to: selectedDate) { selectedDate = next }
    }

    private func accept(_ payloads: [NoteDrag], at minute: Int) -> Bool {
        guard let first = payloads.first, first.day == Planner.dayKey(selectedDate), notes.contains(where: { $0.id == first.id }) else { return false }
        store.move(first.id, date: selectedDate, to: minute); return true
    }
}

@MainActor
private struct NoteEditor: View {
    @EnvironmentObject private var store: PlannerStore
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focused: Bool
    let date: Date
    let minute: Int
    @State private var noteID: String?
    @State private var text: String

    init(date: Date, minute: Int, note: PlannerNote?) {
        self.date = date; self.minute = minute
        _noteID = State(initialValue: note?.id); _text = State(initialValue: note?.text ?? "")
    }
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text(date.formatted(date: .abbreviated, time: .omitted)).font(.caption).foregroundStyle(.secondary)
                TextEditor(text: $text).focused($focused).scrollContentBackground(.hidden).frame(minHeight: 160)
                Text("Saved as you write, on this device.").font(.caption).foregroundStyle(.secondary)
            }.padding(24).background(DaylineTheme.paper)
                .navigationTitle(Planner.label(minute, clock: store.settings.clock)).navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
                .onChange(of: text) { _, value in
                    noteID = store.edit(id: noteID, date: date, minute: minute, text: value)
                }
                .task { focused = true }
        }.presentationDetents([.medium, .large])
    }
}

@MainActor
private struct MoveNoteView: View {
    @EnvironmentObject private var store: PlannerStore
    @Environment(\.dismiss) private var dismiss
    let date: Date
    let note: PlannerNote
    @State private var destination = 0
    var body: some View {
        NavigationStack {
            Form {
                Section("Move to a time") {
                    Picker("Time", selection: $destination) {
                        ForEach((try? Planner.slots(interval: store.settings.interval)) ?? [], id: \.self) { minute in
                            Text(Planner.label(minute, clock: store.settings.clock)).tag(minute)
                        }
                    }.pickerStyle(.wheel)
                }
                Section { Text("Other notes shift toward the space you leave. No text is deleted.").font(.footnote).foregroundStyle(.secondary) }
            }.navigationTitle("A change of plans").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) { Button("Move") { store.move(note.id, date: date, to: destination); dismiss() } }
                }
                .onAppear { destination = Planner.bucket(note.minute, interval: store.settings.interval) }
        }.presentationDetents([.medium, .large])
    }
}
