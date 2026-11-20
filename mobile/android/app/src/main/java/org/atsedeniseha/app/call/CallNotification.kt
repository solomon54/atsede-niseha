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

        val fullScreenIntent = PendingIntent.getActivity(
            context,
            1001,
            Intent(context, IncomingCallActivity::class.java)
                .putExtra(CallIntents.EXTRA_CALL_DATA, payload)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
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
            .setOnlyAlertOnce(true)
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

    /** Start the ringing foreground service (FCM high-priority or JS request). */
    fun startRinging(context: Context, payload: String) {
        if (payload.isBlank()) return
        createChannel(context)
        CallRingtoneController.start(context)
        val intent = Intent(context, CallRingtoneService::class.java)
            .setAction(CallRingtoneService.ACTION_START)
            .putExtra(CallIntents.EXTRA_CALL_DATA, payload)
        try {
            ContextCompat.startForegroundService(context, intent)
        } catch (_: Exception) {
            // Background start may be restricted (e.g. priority downgraded).
            // The call-style notification still lets the user answer/decline.
            showNotificationOnly(context, payload)
        }
    }

    fun showNotificationOnly(context: Context, payload: String) {
        createChannel(context)
        try {
            context.getSystemService(NotificationManager::class.java)
                ?.notify(NOTIFICATION_ID, buildNotification(context, payload))
        } catch (_: Exception) {
        }
    }

    fun stopRinging(context: Context) {
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
    }
}
