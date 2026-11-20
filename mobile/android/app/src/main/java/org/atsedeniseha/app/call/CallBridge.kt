package org.atsedeniseha.app.call

import android.content.Context
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Emits call events to JS when the React context exists. If it does not (cold
 * start), CallIntentsStore keeps the event for consumeInitialCallIntent().
 */
object CallBridge {
    fun currentReactContext(context: Context): ReactContext? = try {
        (context.applicationContext as? ReactApplication)
            ?.reactNativeHost
            ?.reactInstanceManager
            ?.currentReactContext
    } catch (_: Exception) {
        null
    }

    fun emit(context: Context, event: String, payload: String) {
        val reactContext = currentReactContext(context) ?: return
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, payload)
        } catch (_: Exception) {
            // The bridge may be starting or tearing down; the stored intent is
            // still consumed by JS when it becomes ready.
        }
    }

    fun eventFor(action: String): String = when (action) {
        CallIntents.ACTION_ANSWER -> CallIntents.EVENT_ANSWER
        CallIntents.ACTION_DECLINE -> CallIntents.EVENT_DECLINE
        CallIntents.ACTION_HANGUP -> CallIntents.EVENT_HANGUP
        else -> CallIntents.EVENT_HANGUP
    }
}
