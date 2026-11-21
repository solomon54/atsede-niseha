package org.atsedeniseha.app.call

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import org.json.JSONObject

/** Full-screen, lock-screen-safe incoming call presentation. */
class IncomingCallActivity : Activity() {
    private var payload: String = ""
    private var finishReceiver: BroadcastReceiver? = null

    private val currentCallId: String?
        get() = CallPayload.callId(payload)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Wake screen, dismiss keyguard, and show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? android.app.KeyguardManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            keyguardManager?.requestDismissKeyguard(this, null)
        }
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )

        payload = readPayload(intent)
        if (isTerminalPayload()) {
            CallIntentsStore.clearMatching(this, payload)
            finish()
            return
        }
        val data = runCatching { JSONObject(payload) }.getOrDefault(JSONObject())

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0B1120"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setPadding(48, 96, 48, 96)
        }

        val name = TextView(this).apply {
            text = data.optString("callerName", "የንስሐ አባል")
            textSize = 26f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        val role = TextView(this).apply {
            text = roleLabel(data.optString("callerRole", "STUDENT"))
            textSize = 14f
            setTextColor(Color.parseColor("#D97706"))
            gravity = Gravity.CENTER
            setPadding(0, 12, 0, 56)
        }

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        val decline = Button(this).apply {
            text = "አትቀበል"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#DC2626"))
            layoutParams = LinearLayout.LayoutParams(360, 160).apply {
                setMargins(12, 0, 12, 0)
            }
            setOnClickListener { finishWith(CallIntents.ACTION_DECLINE) }
        }
        val answer = Button(this).apply {
            text = "ተቀበል"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#16A34A"))
            layoutParams = LinearLayout.LayoutParams(360, 160).apply {
                setMargins(12, 0, 12, 0)
            }
            setOnClickListener { finishWith(CallIntents.ACTION_ANSWER) }
        }
        actions.addView(decline)
        actions.addView(answer)

        root.addView(name)
        root.addView(role)
        root.addView(actions)
        setContentView(root)
    }

    override fun onStart() {
        super.onStart()
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val target = intent.getStringExtra(CallIntents.EXTRA_CALL_ID).orEmpty()
                if (target.isBlank() || target == currentCallId) finish()
            }
        }
        ContextCompat.registerReceiver(
            this,
            receiver,
            IntentFilter(CallIntents.ACTION_FINISH_INCOMING),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        finishReceiver = receiver
    }

    override fun onStop() {
        finishReceiver?.let { receiver ->
            try {
                unregisterReceiver(receiver)
            } catch (_: Exception) {
            }
        }
        finishReceiver = null
        super.onStop()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        payload = readPayload(intent)
        if (isTerminalPayload()) {
            CallIntentsStore.clearMatching(this, payload)
            finish()
            return
        }
        recreate()
    }

    private fun isTerminalPayload(): Boolean =
        payload.isNotBlank() && CallIntentsStore.isTerminal(this, payload)

    private fun readPayload(intent: Intent): String =
        intent.getStringExtra(CallIntents.EXTRA_CALL_DATA) ?: ""

    private fun finishWith(action: String) {
        if (payload.isNotBlank()) CallActions.perform(this, action, payload)
        finish()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        finishWith(CallIntents.ACTION_DECLINE)
    }

    private fun roleLabel(role: String): String = when (role.trim().uppercase()) {
        "FATHER" -> "የንስሐ አባት"
        "GOVERNOR" -> "የንስሐ ገዥ"
        "CHILD", "STUDENT" -> "የንስሐ ልጅ"
        else -> "የንስሐ አባል"
    }
}
