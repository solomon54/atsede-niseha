package org.atsedeniseha.app.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.atsedeniseha.app.R
import org.json.JSONObject

/** Call-style notification and the foreground service that keeps it alive. */
object CallNotification {
    private const val CHANNEL_ID = CallIntents.NOTIFICATION_CHANNEL_ID
    private const val NOTIFICATION_ID = CallIntents.NOTIFICATION_ID

    private fun pendingFlags(): Int =
        PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0

    private fun roleLabel(role: String): String = when (role.trim().uppercase()) {
        "FATHER" -> "የንስሐ አባት"
        "GOVERNOR" -> "የንስሐ ገዥ"
        "CHILD", "STUDENT" -> "የንስሐ ልጅ"
        else -> "የንስሐ አባል"
    }

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return

        // Clean up legacy channels that might have lower importance or stale notification policy
        try {
            manager.deleteNotificationChannel("atsede-native-call")
            manager.deleteNotificationChannel("atsede-native-call-v2")
            manager.deleteNotificationChannel("atsede-native-call-v3")
        } catch (_: Exception) {}

        val channel = NotificationChannel(
            CHANNEL_ID,
            "Incoming calls",
            NotificationManager.IMPORTANCE_MAX
        ).apply {
            description = "Atsede Niseha continuous incoming call ringing"
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 500, 250, 500, 250, 500)
            setSound(
                Uri.parse("android.resource://${context.packageName}/${R.raw.call_ring}"),
                Notification.AUDIO_ATTRIBUTES_DEFAULT
            )
            setBypassDnd(true)
        }
        manager.createNotificationChannel(channel)
    }

    private fun actionIntent(
        context: Context,
        action: String,
        payload: String,
        requestCode: Int
    ): PendingIntent {
        val intent = Intent(context, CallActionReceiver::class.java)
            .setAction(CallIntents.ACTION_BROADCAST)
            .putExtra(CallIntents.EXTRA_ACTION, action)
            .putExtra(CallIntents.EXTRA_CALL_DATA, payload)
        return PendingIntent.getBroadcast(context, requestCode, intent, pendingFlags())
    }

    fun buildNotification(context: Context, payload: String): Notification {
        val data = runCatching { JSONObject(payload) }.getOrDefault(JSONObject())
        val name = data.optString("callerName", "የንስሐ አባል")
        val role = data.optString("callerRole", "STUDENT")
        val isGroup = data.optString("isGroup", "false") == "true"
        val label = roleLabel(role)
        val callId = CallPayload.callId(payload) ?: ""

        val fullScreenIntent = PendingIntent.getActivity(
            context,
            1001,
            Intent(context, IncomingCallActivity::class.java)
                .putExtra(CallIntents.EXTRA_CALL_DATA, payload)
                .putExtra(CallIntents.EXTRA_CALL_ID, callId)
                .addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
                ),
            pendingFlags()
        )

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_call_notification)
            .setContentTitle(name)
            .setContentText(if (isGroup) "የጋራ ቤት ጥሪ እየጠራ ነው" else "ጥሪ እየጠራ ነው")
            .setSubText(label)
            .setStyle(NotificationCompat.BigTextStyle().bigText("$name · $label"))
            .setOngoing(true)
            .setAutoCancel(false)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(Uri.parse("android.resource://${context.packageName}/${R.raw.call_ring}"))
            .setVibrate(longArrayOf(0, 500, 250, 500, 250, 500))
            .setContentIntent(fullScreenIntent)
            .setFullScreenIntent(fullScreenIntent, true)
            .addAction(
                R.drawable.ic_call_notification,
                "ተቀበል",
                actionIntent(context, CallIntents.ACTION_ANSWER, payload, 1002)
            )
            .addAction(
                R.drawable.ic_call_notification,
                "አትቀበል",
                actionIntent(context, CallIntents.ACTION_DECLINE, payload, 1003)
            )
            .build()
    }

    /** Start the ringing foreground service (JS only, after status validation). */
    fun startRinging(context: Context, payload: String) {
        if (payload.isBlank()) return
        val callId = CallPayload.callId(payload)
        if (!CallPresentationState.matches(callId)) {
            stopRinging(context, CallPresentationState.activeCallId)
        }
        CallPresentationState.setFrom(payload)
        createChannel(context)
        CallRingtoneController.start(context)
        val intent = Intent(context, CallRingtoneService::class.java)
            .setAction(CallRingtoneService.ACTION_START)
            .putExtra(CallIntents.EXTRA_CALL_DATA, payload)
        try {
            ContextCompat.startForegroundService(context, intent)
        } catch (_: Exception) {
            // Background start may be restricted. The call-style notification
            // still lets the user answer/decline; JS remains authoritative.
            showNotificationOnly(context, payload)
        }

        // Proactively pop incoming call activity if screen is off or keyguard is locked
        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as? android.app.KeyguardManager
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
        val isScreenOff = powerManager?.isInteractive == false
        val isLocked = keyguardManager?.isKeyguardLocked == true
        if (isScreenOff || isLocked) {
            try {
                val callActivityIntent = Intent(context, IncomingCallActivity::class.java).apply {
                    putExtra(CallIntents.EXTRA_CALL_DATA, payload)
                    putExtra(CallIntents.EXTRA_CALL_ID, callId ?: "")
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                    )
                }
                context.startActivity(callActivityIntent)
            } catch (_: Exception) {}
        }
    }

    fun showNotificationOnly(context: Context, payload: String) {
        if (payload.isBlank()) return
        CallPresentationState.setFrom(payload)
        createChannel(context)
        try {
            context.getSystemService(NotificationManager::class.java)
                ?.notify(NOTIFICATION_ID, buildNotification(context, payload))
        } catch (_: Exception) {
        }
    }

    fun stopRinging(context: Context) = stopRinging(context, null)

    /** Stops ringing only when the request targets the currently presented call. */
    fun stopRinging(context: Context, payload: String?) {
        val callId = payload?.let { CallPayload.callId(it) }
        if (!CallPresentationState.matches(callId)) return

        CallRingtoneController.stop()
        try {
            context.stopService(Intent(context, CallRingtoneService::class.java))
        } catch (_: Exception) {
        }
        try {
            context.getSystemService(NotificationManager::class.java)
                ?.cancel(NOTIFICATION_ID)
        } catch (_: Exception) {
        }

        val finish = Intent(CallIntents.ACTION_FINISH_INCOMING)
            .putExtra(CallIntents.EXTRA_CALL_ID, callId ?: "")
        try {
            context.sendBroadcast(finish)
        } catch (_: Exception) {
        }
        CallPresentationState.clearIfMatches(callId)
    }

    /**
     * Complete, idempotent cleanup. A terminal result writes a tombstone so a
     * pending full-screen intent or persisted replay cannot re-open the call.
     */
    fun cleanupCall(context: Context, payload: String, terminal: Boolean) {
        if (payload.isBlank()) return
        if (terminal) CallIntentsStore.markTerminal(context, payload)
        CallIntentsStore.clearMatching(context, payload)
        stopRinging(context, payload)
    }
}
