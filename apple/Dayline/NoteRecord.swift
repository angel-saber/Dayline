import CoreData

@objc(DaylineNoteRecord)
final class NoteRecord: NSManagedObject {
    @NSManaged var noteID: String
    @NSManaged var day: String
    @NSManaged var text: String
    @NSManaged var minute: Int64
    @NSManaged var done: Bool
    @NSManaged var trashed: Bool
    @NSManaged var modifiedAt: Date
}

enum DaylineModel {
    static func make() -> NSManagedObjectModel {
        let entity = NSEntityDescription()
        entity.name = "NoteRecord"
        entity.managedObjectClassName = NSStringFromClass(NoteRecord.self)
        func attribute(_ name: String, _ type: NSAttributeType, _ value: Any) -> NSAttributeDescription {
            let field = NSAttributeDescription()
            field.name = name
            field.attributeType = type
            field.isOptional = false
            field.defaultValue = value
            return field
        }
        // CloudKit requires defaults or optional attributes. No uniqueness
        // constraints are used; identities are generated before insertion.
        entity.properties = [
            attribute("noteID", .stringAttributeType, ""),
            attribute("day", .stringAttributeType, ""),
            attribute("text", .stringAttributeType, ""),
            attribute("minute", .integer64AttributeType, 0),
            attribute("done", .booleanAttributeType, false),
            attribute("trashed", .booleanAttributeType, false),
            attribute("modifiedAt", .dateAttributeType, Date(timeIntervalSince1970: 0))
        ]
        let model = NSManagedObjectModel()
        model.entities = [entity]
        model.versionIdentifiers = ["Dayline-1"]
        return model
    }
}
