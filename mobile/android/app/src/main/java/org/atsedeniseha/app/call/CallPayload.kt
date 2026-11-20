package org.atsedeniseha.app.call

/**
 * Small, dependency-free helpers for call payload identity.
 *
 * Kept free of Android and org.json calls so persisted-intent cleanup can be
 * covered by local JVM tests without Robolectric.
 */
object CallPayload {
    private val CALL_ID_PATTERN = Regex("\"callId\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"")

    fun callId(payload: String?): String? {
        if (payload.isNullOrBlank()) return null
        val raw = CALL_ID_PATTERN.find(payload)?.groupValues?.getOrNull(1) ?: return null
        val decoded = unescape(raw)
        return decoded.takeIf { it.isNotBlank() }
    }

    fun matches(left: String?, right: String?): Boolean {
        val leftId = callId(left)
        val rightId = callId(right)
        if (leftId != null && rightId != null) return leftId == rightId
        return !left.isNullOrBlank() && left == right
    }

    private fun unescape(raw: String): String = raw
        .replace("\\\"", "\"")
        .replace("\\\\", "\\")
        .replace("\\n", "\n")
        .replace("\\r", "\r")
        .replace("\\t", "\t")
        .replace("\\/", "/")
}
