package org.atsedeniseha.app.call

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject

/** Full-screen, lock-screen-safe incoming call presentation. */
class IncomingCallActivity : Activity() {
    private var payload: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        payload = readPayload(intent)
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        payload = readPayload(intent)
        recreate()
    }

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
