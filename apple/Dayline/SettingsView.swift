import SwiftUI
import UniformTypeIdentifiers
import UIKit
import DaylineCore

@MainActor
struct SettingsView: View {
    @EnvironmentObject private var store: PlannerStore
    @EnvironmentObject private var reminders: ReminderScheduler
    @AppStorage("dayline.icloud") private var cloudRequested = false
    @State private var intervalChoice = 60
    @State private var customMinutes = "60"
    @State private var showRestartNotice = false
    @State private var exporting = false
    @State private var importing = false
    @State private var exportDocument = BackupDocument(data: Data())
    @State private var pendingBackup: PlannerBackup?
    private let presets = [15, 30, 60, 120, 240]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("A rhythm that fits.").font(.system(.largeTitle, design: .serif))
                    Text("A few small settings for your kind of day.").foregroundStyle(.secondary)
                }.listRowBackground(Color.clear)
                Section("Your timeline") {
                    Picker("Time intervals", selection: $intervalChoice) {
                        Text("15 minutes").tag(15); Text("30 minutes").tag(30)
                        Text("1 hour").tag(60); Text("2 hours").tag(120); Text("4 hours").tag(240)
                        Text("Custom").tag(0)
                    }.onChange(of: intervalChoice) { _, value in if value != 0 { store.settings.interval = value } }
                    if intervalChoice == 0 {
                        HStack {
                            TextField("Minutes", text: $customMinutes).keyboardType(.numberPad)
                                .accessibilityLabel("Custom interval in minutes")
                            Button("Apply") { applyCustom() }
                        }
                    }
                    Picker("Time format", selection: $store.settings.clock) {
                        Text("12-hour").tag("12"); Text("24-hour").tag("24")
                    }
                    Text("Changing intervals keeps every note. Notes that fall into the same interval appear together.").font(.footnote).foregroundStyle(.secondary)
                }
                Section("A gentle nudge") {
                    Toggle("Time reminders", isOn: Binding(get: { store.settings.notifications }, set: { enabled in
                        if !enabled { store.settings.notifications = false }
                        else { Task { store.settings.notifications = await reminders.requestPermission() } }
                    }))
                    Toggle("Play a sound", isOn: $store.settings.sound)
                    Button("Test sound", systemImage: "speaker.wave.2") { reminders.testSound() }
                    Text(reminders.description).font(.footnote).foregroundStyle(.secondary)
                    Text("Reminders cover the next 60 occupied intervals. Opening Dayline refreshes the schedule. Silent mode, Focus, and notification settings can silence alerts.").font(.footnote).foregroundStyle(.secondary)
                    Button("Device notification settings") {
                        if let url = URL(string: UIApplication.openNotificationSettingsURLString) { UIApplication.shared.open(url) }
                    }
                }
                Section("Your notes, kept close") {
                    if PlannerStore.cloudBuild {
                        Toggle("Sync with my iCloud", isOn: $cloudRequested)
                            .onChange(of: cloudRequested) { _, _ in showRestartNotice = true }
                        Text(store.cloudDescription).font(.footnote).foregroundStyle(.secondary)
                        if cloudRequested != store.cloudEnabledAtLaunch {
                            Text("Close and reopen Dayline to apply this change. Your local notes are kept.").font(.footnote)
                        }
                    } else {
                        Label("On-device saving", systemImage: "iphone")
                        Text("This version stores notes on this device. Optional iCloud sync will be available in the iCloud-enabled version. No Dayline account is needed.").font(.footnote).foregroundStyle(.secondary)
                    }
                    Button("Download a backup", systemImage: "square.and.arrow.up") {
                        do { exportDocument = BackupDocument(data: try store.backup()); exporting = true }
                        catch { store.error = error.localizedDescription }
                    }
                    Button("Import a backup", systemImage: "square.and.arrow.down") { importing = true }
                    Text("Backups work with the Dayline web prototype too. Importing adds notes and keeps existing notes.").font(.footnote).foregroundStyle(.secondary)
                }
                Section {
                    Text("Your notes belong to you. No separate login, advertising, or analytics.").font(.footnote).foregroundStyle(.secondary)
                    Text(store.saveDescription).font(.caption).foregroundStyle(.secondary)
                }
            }
            .scrollContentBackground(.hidden).background(DaylineTheme.paper)
            .navigationTitle("Settings").navigationBarTitleDisplayMode(.inline)
            .onAppear {
                intervalChoice = presets.contains(store.settings.interval) ? store.settings.interval : 0
                customMinutes = String(store.settings.interval)
            }
            .fileExporter(isPresented: $exporting, document: exportDocument, contentType: .json, defaultFilename: "dayline-backup-\(Planner.dayKey(Date()))") { result in
                if case .failure(let error) = result { store.error = error.localizedDescription }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json], allowsMultipleSelection: false) { result in
                do {
                    guard let url = try result.get().first else { return }
                    let scoped = url.startAccessingSecurityScopedResource()
                    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                    if let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize, size > 10 * 1024 * 1024 { throw PlannerError.backup }
                    pendingBackup = try PlannerBackup.decode(Data(contentsOf: url))
                } catch { store.error = error.localizedDescription }
            }
            .alert("Add backup notes?", isPresented: Binding(get: { pendingBackup != nil }, set: { if !$0 { pendingBackup = nil } })) {
                Button("Cancel", role: .cancel) { pendingBackup = nil }
                Button("Add notes") { if let backup = pendingBackup { store.importBackup(backup) }; pendingBackup = nil }
            } message: { Text("Existing notes are kept. If iCloud is enabled, added notes will also sync to your other devices.") }
            .alert("Apply iCloud preference", isPresented: $showRestartNotice) {
                Button("OK", role: .cancel) {}
            } message: { Text("Close and reopen Dayline to apply your preference. Turning sync off keeps notes already stored in iCloud and on this device.") }
        }
    }

    private func applyCustom() {
        guard let value = Int(customMinutes), (1...1440).contains(value) else { store.error = PlannerError.interval.localizedDescription; return }
        store.settings.interval = value
    }
}
