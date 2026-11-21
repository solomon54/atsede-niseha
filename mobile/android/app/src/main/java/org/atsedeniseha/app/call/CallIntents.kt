package org.atsedeniseha.app.call

import org.json.JSONObject

object CallIntents {
    const val EXTRA_ACTION = "org.atsedeniseha.app.call.ACTION"
    const val EXTRA_CALL_DATA = "org.atsedeniseha.app.call.DATA"
    const val EXTRA_CALL_ID = "org.atsedeniseha.app.call.CALL_ID"
    const val EXTRA_INCOMING_HINT = "org.atsedeniseha.app.call.INCOMING_HINT"

    const val ACTION_BROADCAST = "org.atsedeniseha.app.call.CALL_ACTION"
    const val ACTION_FINISH_INCOMING = "org.atsedeniseha.app.call.FINISH_INCOMING"

    const val ACTION_ANSWER = "answer"
    const val ACTION_DECLINE = "decline"
    const val ACTION_HANGUP = "hangup"
    const val ACTION_INCOMING = "incoming"

    const val EVENT_INCOMING = "CallIncoming"
    const val EVENT_ANSWER = "CallAnswer"
    const val EVENT_DECLINE = "CallDecline"
    const val EVENT_HANGUP = "CallHangup"

    const val NOTIFICATION_CHANNEL_ID = "atsede-native-call-v4"
    const val NOTIFICATION_ID = 9101
}

fun incomingCallJson(data: Map<String, String>): String {
    val json = JSONObject()
    data.forEach { (key, value) -> json.put(key, value) }
    if (!json.has("isGroup")) json.put("isGroup", "false")
    if (!json.has("callerName")) json.put("callerName", "የንስሐ አባል")
    if (!json.has("callerRole")) json.put("callerRole", "STUDENT")
    if (!json.has("callerPhotoUrl")) json.put("callerPhotoUrl", "")
    if (!json.has("startedAt")) json.put("startedAt", System.currentTimeMillis().toString())
    return json.toString()
}

fun jsonString(value: String): String {
    return try {
        JSONObject.quote(value)
    } catch (_: Exception) {
        "\"\""
    }
}
