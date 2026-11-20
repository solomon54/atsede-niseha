package org.atsedeniseha.app.call

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import org.json.JSONObject

/** JS bridge: native owns ringing/presentation, JS owns state transitions. */
class CallNotificationModule(private val appContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(appContext) {

    override fun getName(): String = "CallNotificationModule"

    private fun JSONObject.toStringMap(): Map<String, String> {
        val map = mutableMapOf<String, String>()
        keys().forEach { key -> map[key] = optString(key, "") }
        return map
    }

    @ReactMethod
    fun showIncomingCall(json: String) {
        if (json.isBlank()) return
        val data = runCatching { JSONObject(json) }.getOrDefault(JSONObject())
        val payload = incomingCallJson(data.toStringMap())
        CallIntentsStore.saveIncoming(appContext, payload)
        CallNotification.startRinging(appContext, payload)
    }

    @ReactMethod
    fun stopRinging() {
        CallNotification.stopRinging(appContext)
    }

    @ReactMethod
    fun setSpeaker(enabled: Boolean) {
        CallRingtoneController.setSpeaker(appContext, enabled)
    }

    @ReactMethod
    fun consumeInitialCallIntent(promise: Promise) {
        val result: WritableMap = Arguments.createMap()
        val action = CallIntentsStore.consume(appContext)
        if (action != null) {
            result.putString("action", action.first)
            result.putString("payload", action.second)
        } else {
            val incoming = CallIntentsStore.consumeIncoming(appContext)
            if (incoming != null) {
                result.putString("action", CallIntents.ACTION_INCOMING)
                result.putString("payload", incoming)
            }
        }
        promise.resolve(result)
    }
}
