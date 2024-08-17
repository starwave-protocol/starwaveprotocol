export default class EncodingUtils {
    static serializeMessage(message) {
        //TODO: We need to use determined serialization here
        return JSON.stringify(message);
    }

    static deserializeMessage(message) {
        //TODO: We need to use determined deserialization here
        return JSON.parse(message);
    }
}
