import SwiftUI
import UIKit
import DaylineCore

@main
@MainActor
struct DaylineApp: App {
    @StateObject private var store = PlannerStore()
    @StateObject private var reminders = ReminderScheduler()
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(reminders)
                .tint(DaylineTheme.green)
                .task { await reschedule() }
                .onChange(of: store.isReady) { _, ready in if ready { Task { await reschedule() } } }
                .onChange(of: store.days) { _, _ in Task { await reschedule() } }
                .onChange(of: store.settings) { _, _ in Task { await reschedule() } }
                .onChange(of: phase) { _, value in
                    if value == .active {
                        store.refresh()
                        Task { await store.checkCloudAccount(); await reschedule() }
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in
                    Task { await reschedule() }
                }
        }
    }

    @MainActor private func reschedule() async {
        guard store.isReady else { return }
        await reminders.update(days: store.days, settings: store.settings)
    }
}

enum DaylineTheme {
    static let paper = Color(red: 0.96, green: 0.955, blue: 0.935)
    static let green = Color(red: 0.37, green: 0.47, blue: 0.36)
    static let ink = Color(red: 0.18, green: 0.23, blue: 0.19)
}

@MainActor
struct RootView: View {
    @EnvironmentObject private var store: PlannerStore
    @State private var selectedTab = 0

    var body: some View {
        Group {
            if store.isReady {
                TabView(selection: $selectedTab) {
                    DailyView().tabItem { Label("Daily", systemImage: "calendar") }.tag(0)
                    SettingsView().tabItem { Label("Settings", systemImage: "slider.horizontal.3") }.tag(1)
                }
            } else {
                VStack(spacing: 22) {
                    Image(systemName: "sun.horizon").font(.largeTitle).foregroundStyle(DaylineTheme.green)
                    Text("dayline.").font(.largeTitle.weight(.semibold))
                    if store.error == nil { ProgressView("Opening your notes…") }
                    else {
                        Text("Your notes could not be opened. The existing store has been kept.").multilineTextAlignment(.center)
                        Button("Try again") { store.error = nil; store.open() }.buttonStyle(.borderedProminent)
                    }
                }.padding(32)
            }
        }
        .preferredColorScheme(.light)
        .alert("Dayline", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) {
            Button("OK") { store.error = nil }
        } message: { Text(store.error ?? "") }
        .alert("Dayline", isPresented: Binding(get: { store.message != nil }, set: { if !$0 { store.message = nil } })) {
            Button("OK") { store.message = nil }
        } message: { Text(store.message ?? "") }
    }
}
