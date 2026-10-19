import XCTest
@testable import DaylineCore

final class PlannerTests: XCTestCase {
    func testIntervalsCoverWholeDay() throws {
        for interval in [1, 15, 30, 47, 60, 120, 240, 1440] {
            let slots = try Planner.slots(interval: interval)
            XCTAssertEqual(slots.first, 0)
            XCTAssertLessThan(slots.last!, 1440)
            XCTAssertGreaterThanOrEqual(slots.last! + interval, 1440)
        }
        for bad in [0, -1, 1441] { XCTAssertThrowsError(try Planner.slots(interval: bad)) }
    }

    func testInsertionMovesOthersAndPreservesOriginal() {
        let notes = [PlannerNote(id: "a", text: "A", minute: 480), PlannerNote(id: "b", text: "B", minute: 540), PlannerNote(id: "c", text: "C", minute: 600)]
        let moved = Planner.move(notes, id: "c", to: 480, interval: 60)
        XCTAssertEqual(moved.map(\.id), ["c", "a", "b"])
        XCTAssertEqual(moved.map(\.minute), [480, 540, 600])
        XCTAssertEqual(notes.first?.minute, 480)
    }

    func testAllMovesPreserveEveryNote() throws {
        for interval in [15, 47, 60, 120, 240] {
            let slots = try Planner.slots(interval: interval)
            let notes = slots.enumerated().map { PlannerNote(id: String($0.offset), text: "Note", minute: $0.element) }
            for source in [0, slots.count / 2, slots.count - 1] {
                for target in slots {
                    let moved = Planner.move(notes, id: String(source), to: target, interval: interval)
                    XCTAssertEqual(moved.count, notes.count)
                    XCTAssertEqual(Set(moved.map(\.minute)).count, notes.count)
                    XCTAssertEqual(moved.first(where: { $0.id == String(source) })?.minute, target)
                }
            }
        }
    }

    func testMultipleNotesInOneIntervalAreRetained() {
        let notes = [PlannerNote(id: "a", text: "A", minute: 480), PlannerNote(id: "b", text: "B", minute: 495), PlannerNote(id: "c", text: "C", minute: 540)]
        let moved = Planner.move(notes, id: "a", to: 540, interval: 60)
        XCTAssertEqual(Set(moved.map(\.id)), Set(notes.map(\.id)))
        XCTAssertEqual(moved.first(where: { $0.id == "b" })?.minute, 495)
    }

    func testCalendarValidationAndMidnight() {
        XCTAssertNotNil(Planner.date(for: "2024-02-29"))
        XCTAssertNil(Planner.date(for: "2026-02-29"))
        XCTAssertNil(Planner.date(for: "2026-13-01"))
        XCTAssertEqual(Planner.label(0), "12:00 AM")
        XCTAssertEqual(Planner.label(720), "12:00 PM")
        XCTAssertEqual(Planner.label(1440, clock: "24"), "24:00")
    }

    func testBackupRoundTripAndWebFormat() throws {
        let json = #"{"version":1,"days":{"2026-10-19":[{"id":"web-id","text":"<literal>\n☀️","minute":540,"done":false}]},"settings":{"interval":47,"clock":"12","notifications":true,"sound":true}}"#
        let backup = try PlannerBackup.decode(Data(json.utf8))
        XCTAssertEqual(backup.days["2026-10-19"]?.first?.text, "<literal>\n☀️")
        XCTAssertEqual(backup.settings.interval, 47)
        let encoded = try JSONEncoder().encode(backup)
        XCTAssertEqual(try PlannerBackup.decode(encoded).days, backup.days)
    }

    func testInvalidBackupAndDuplicateNotesFailBeforeImport() throws {
        let note = PlannerNote(id: "same", text: "A", minute: 10)
        XCTAssertThrowsError(try PlannerBackup(days: ["2026-02-30": []], settings: .init()).validated())
        XCTAssertThrowsError(try PlannerBackup(days: ["2026-10-19": [note, note]], settings: .init()).validated())
    }

    func testRemindersGroupIntervalsAndExcludeDoneEmptyAndPastNotes() throws {
        let date = try XCTUnwrap(Planner.date(for: "2030-10-19"))
        let morning = try XCTUnwrap(Planner.calendar.date(bySettingHour: 8, minute: 0, second: 0, of: date))
        let notes = [PlannerNote(id: "a", text: "first", minute: 540), PlannerNote(id: "b", text: "second", minute: 555), PlannerNote(id: "done", text: "done", minute: 600, done: true), PlannerNote(id: "empty", text: "  ", minute: 600), PlannerNote(id: "past", text: "past", minute: 420)]
        let plans = Planner.reminders(days: ["2030-10-19": notes], interval: 60, after: morning)
        XCTAssertEqual(plans.count, 1)
        XCTAssertEqual(plans.first?.text, "first\nsecond")
        XCTAssertEqual(Planner.calendar.component(.hour, from: plans[0].date), 9)
    }

    func testRemindersUseBoundedUpcomingWindow() throws {
        let date = try XCTUnwrap(Planner.date(for: "2030-10-19"))
        let start = try XCTUnwrap(Planner.calendar.date(bySettingHour: 0, minute: 0, second: 0, of: date))
        let notes = (1...120).map { PlannerNote(id: String($0), text: "note", minute: $0) }
        let plans = Planner.reminders(days: ["2030-10-19": notes], interval: 1, after: start)
        XCTAssertEqual(plans.count, 60)
        XCTAssertTrue(zip(plans, plans.dropFirst()).allSatisfy { pair in pair.0.date < pair.1.date })
    }
}
