package org.atsedeniseha.app.call

import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FakeSharedPreferences : SharedPreferences {
    internal val values = mutableMapOf<String, Any?>()

    override fun getAll(): MutableMap<String, *> = values.toMutableMap()

    override fun getString(key: String?, defValue: String?): String? =
        values[key] as? String ?: defValue

    override fun getStringSet(
        key: String?,
        defValues: MutableSet<String>?
    ): MutableSet<String>? {
        val stored = values[key] ?: return defValues
        @Suppress("UNCHECKED_CAST")
        return (stored as? Set<String>)?.toMutableSet() ?: defValues
    }

    override fun getInt(key: String?, defValue: Int): Int = values[key] as? Int ?: defValue

    override fun getLong(key: String?, defValue: Long): Long = values[key] as? Long ?: defValue

    override fun getFloat(key: String?, defValue: Float): Float = values[key] as? Float ?: defValue

    override fun getBoolean(key: String?, defValue: Boolean): Boolean =
        values[key] as? Boolean ?: defValue

    override fun contains(key: String?): Boolean = values.containsKey(key)

    override fun edit(): SharedPreferences.Editor = EditorImpl(this)

    override fun registerOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?
    ) {
    }

    override fun unregisterOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?
    ) {
    }

    private class EditorImpl(private val prefs: FakeSharedPreferences) : SharedPreferences.Editor {
        private val changes = mutableMapOf<String, Any?>()
        private val removals = mutableSetOf<String>()
        private var clearAll = false

        override fun putString(key: String?, value: String?) = put(key, value)

        override fun putStringSet(key: String?, values: MutableSet<String>?) = put(key, values)

        override fun putInt(key: String?, value: Int) = put(key, value)

        override fun putLong(key: String?, value: Long) = put(key, value)

        override fun putFloat(key: String?, value: Float) = put(key, value)

        override fun putBoolean(key: String?, value: Boolean) = put(key, value)

        private fun put(key: String?, value: Any?): SharedPreferences.Editor {
            if (key != null) {
                removals.remove(key)
                changes[key] = value
            }
            return this
        }

        override fun remove(key: String?): SharedPreferences.Editor {
            if (key != null) {
                changes.remove(key)
                removals.add(key)
            }
            return this
        }

        override fun clear(): SharedPreferences.Editor {
            clearAll = true
            changes.clear()
            removals.clear()
            return this
        }

        override fun commit(): Boolean {
            applyChanges()
            return true
        }

        override fun apply() {
            applyChanges()
        }

        private fun applyChanges() {
            if (clearAll) prefs.values.clear()
            removals.forEach { prefs.values.remove(it) }
            prefs.values.putAll(changes)
        }
    }
}

class CallIntentsStoreTest {
    private fun payload(callId: String, channelId: String = "channel-1") =
        """{"callId":"$callId","channelId":"$channelId","callerName":"Tester","isGroup":"false"}"""

    @Test
    fun `cleanup clears action, payload, and incoming state and is idempotent`() {
        val prefs = FakeSharedPreferences()
        CallIntentsStore.saveIncoming(prefs, payload("call-old"))
        CallIntentsStore.saveAction(prefs, "answer", payload("call-old"))

        assertEquals("answer", CallIntentsStore.peek(prefs)?.first)
        assertEquals(payload("call-old"), CallIntentsStore.peekIncoming(prefs))

        CallIntentsStore.clearMatching(prefs, payload("call-old"))
        assertNull(CallIntentsStore.peek(prefs))
        assertNull(CallIntentsStore.peekIncoming(prefs))

        // Repeated cleanup must remain safe.
        CallIntentsStore.clearMatching(prefs, payload("call-old"))
        assertNull(CallIntentsStore.peek(prefs))
        assertNull(CallIntentsStore.peekIncoming(prefs))
    }

    @Test
    fun `cleanup is call-id-aware and preserves a newer call`() {
        val prefs = FakeSharedPreferences()
        CallIntentsStore.saveAction(prefs, "decline", payload("call-old"))
        CallIntentsStore.saveIncoming(prefs, payload("call-new"))

        CallIntentsStore.clearMatching(prefs, payload("call-old"))

        assertNull(CallIntentsStore.peek(prefs))
        assertEquals(payload("call-new"), CallIntentsStore.peekIncoming(prefs))

        CallIntentsStore.clearMatching(prefs, payload("call-new"))
        assertNull(CallIntentsStore.peekIncoming(prefs))
    }

    @Test
    fun `terminal calls cannot be persisted again until explicitly unmarked`() {
        val prefs = FakeSharedPreferences()
        CallIntentsStore.markTerminal(prefs, payload("call-old"))

        assertTrue(CallIntentsStore.isTerminal(prefs, payload("call-old")))
        CallIntentsStore.saveIncoming(prefs, payload("call-old"))
        assertNull(CallIntentsStore.peekIncoming(prefs))

        CallIntentsStore.unmarkTerminal(prefs, payload("call-old"))
        assertFalse(CallIntentsStore.isTerminal(prefs, payload("call-old")))
        CallIntentsStore.saveIncoming(prefs, payload("call-old"))
        assertEquals(payload("call-old"), CallIntentsStore.peekIncoming(prefs))
    }

    @Test
    fun `consuming an action does not replay an incoming payload`() {
        val prefs = FakeSharedPreferences()
        CallIntentsStore.saveIncoming(prefs, payload("call-1"))
        CallIntentsStore.saveAction(prefs, "answer", payload("call-1"))

        val action = CallIntentsStore.consumeAction(prefs)
        assertEquals("answer", action?.first)
        assertNull(CallIntentsStore.peek(prefs))
        assertEquals(payload("call-1"), CallIntentsStore.peekIncoming(prefs))
    }

    @Test
    fun `call id extraction ignores escaped payload noise`() {
        assertEquals("call-1", CallPayload.callId(payload("call-1")))
        assertNull(CallPayload.callId("""{"channelId":"channel-1"}"""))
        assertTrue(CallPayload.matches(payload("call-1"), payload("call-1", "other-channel")))
        assertFalse(CallPayload.matches(payload("call-1"), payload("call-2")))
    }
}
