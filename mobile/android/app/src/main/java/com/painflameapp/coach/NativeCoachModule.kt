package com.painflameapp.coach

import android.content.Intent
import android.media.MediaPlayer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.painflameapp.specs.NativeCoachSpec
import java.util.Locale
import java.util.UUID

/**
 * Exercise-session helper: text-to-speech, "Go"/"Start" voice commands,
 * whistle/bell sounds and keeping the screen awake.
 * All state is touched on the main thread only.
 */
class NativeCoachModule(private val context: ReactApplicationContext) :
    NativeCoachSpec(context), TextToSpeech.OnInitListener {

  companion object {
    const val NAME = "NativeCoach"
    private const val MAX_RECOGNIZER_ERRORS = 3
  }

  private val main = Handler(Looper.getMainLooper())

  // --- Text to speech ---
  private var tts: TextToSpeech? = null
  private var ttsReady = false
  private var ttsFailed = false
  private val waitingForTts = mutableListOf<() -> Unit>()
  private val utterances = HashMap<String, Promise>()

  // --- Speech recognition ---
  private var recognizer: SpeechRecognizer? = null
  private var listenPromise: Promise? = null
  private var listenWords: Set<String> = emptySet()
  private var listenDeadline = 0L
  private var recognizerErrors = 0
  private val listenTimeout = Runnable { finishListening("timeout") }

  // --- Sounds ---
  private var player: MediaPlayer? = null
  private var soundPromise: Promise? = null

  init {
    main.post { tts = TextToSpeech(context, this) }
  }

  override fun getName() = NAME

  // region Text to speech

  override fun onInit(status: Int) {
    main.post {
      val engine = tts
      if (status != TextToSpeech.SUCCESS || engine == null) {
        ttsFailed = true
      } else {
        val india = Locale("en", "IN")
        engine.language =
            if (engine.isLanguageAvailable(india) >= TextToSpeech.LANG_AVAILABLE) india
            else Locale.US
        engine.setSpeechRate(0.9f)
        engine.setOnUtteranceProgressListener(
            object : UtteranceProgressListener() {
              override fun onStart(utteranceId: String?) {}

              override fun onDone(utteranceId: String?) = finishUtterance(utteranceId)

              @Deprecated("Deprecated in Java")
              override fun onError(utteranceId: String?) = finishUtterance(utteranceId)

              override fun onError(utteranceId: String?, errorCode: Int) =
                  finishUtterance(utteranceId)

              override fun onStop(utteranceId: String?, interrupted: Boolean) =
                  finishUtterance(utteranceId)
            })
        ttsReady = true
      }
      waitingForTts.forEach { it() }
      waitingForTts.clear()
    }
  }

  private fun finishUtterance(id: String?) {
    if (id == null) return
    main.post { utterances.remove(id)?.resolve(null) }
  }

  override fun speak(text: String, promise: Promise) {
    main.post {
      val run = {
        val engine = tts
        if (ttsFailed || engine == null) {
          promise.resolve(null)
        } else {
          val id = UUID.randomUUID().toString()
          utterances[id] = promise
          if (engine.speak(text, TextToSpeech.QUEUE_FLUSH, Bundle(), id) == TextToSpeech.ERROR) {
            utterances.remove(id)
            promise.resolve(null)
          }
        }
      }
      if (ttsReady || ttsFailed) run() else waitingForTts.add(run)
    }
  }

  override fun stopSpeaking() {
    main.post {
      tts?.stop()
      utterances.values.forEach { it.resolve(null) }
      utterances.clear()
    }
  }

  // endregion

  // region Speech recognition

  override fun isRecognitionAvailable(promise: Promise) {
    main.post { promise.resolve(SpeechRecognizer.isRecognitionAvailable(context)) }
  }

  override fun listen(words: ReadableArray, windowMs: Double, promise: Promise) {
    main.post {
      finishListening("cancelled")
      if (!SpeechRecognizer.isRecognitionAvailable(context)) {
        promise.resolve("unavailable")
        return@post
      }
      listenWords = (0 until words.size()).mapNotNull { words.getString(it)?.lowercase() }.toSet()
      listenPromise = promise
      recognizerErrors = 0
      listenDeadline = SystemClock.elapsedRealtime() + windowMs.toLong()
      main.postDelayed(listenTimeout, windowMs.toLong())
      startRecognizer()
    }
  }

  override fun stopListening() {
    main.post { finishListening("cancelled") }
  }

  private fun startRecognizer() {
    if (listenPromise == null) return
    recognizer?.destroy()
    val created = SpeechRecognizer.createSpeechRecognizer(context)
    recognizer = created
    created.setRecognitionListener(listener)
    val intent =
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
          putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
          putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
        }
    created.startListening(intent)
  }

  /** The recogniser stops after each phrase or silence; restart it until the window ends. */
  private fun restartIfTimeLeft(delayMs: Long = 150) {
    if (listenPromise == null) return
    if (SystemClock.elapsedRealtime() < listenDeadline - 300) {
      main.postDelayed({ startRecognizer() }, delayMs)
    } else {
      finishListening("timeout")
    }
  }

  private fun heardCommand(results: Bundle?): Boolean {
    val phrases = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return false
    val heard =
        phrases.any { phrase ->
          phrase.lowercase().split(Regex("[^\\p{L}]+")).any { it in listenWords }
        }
    if (heard) finishListening("matched")
    return heard
  }

  private val listener =
      object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}

        override fun onBeginningOfSpeech() {}

        override fun onRmsChanged(rmsdB: Float) {}

        override fun onBufferReceived(buffer: ByteArray?) {}

        override fun onEndOfSpeech() {}

        override fun onEvent(eventType: Int, params: Bundle?) {}

        override fun onPartialResults(partialResults: Bundle?) {
          heardCommand(partialResults)
        }

        override fun onResults(results: Bundle?) {
          if (!heardCommand(results)) restartIfTimeLeft()
        }

        override fun onError(error: Int) {
          when (error) {
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> finishListening("permission")
            SpeechRecognizer.ERROR_NO_MATCH,
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> restartIfTimeLeft()
            else -> {
              recognizerErrors++
              if (recognizerErrors >= MAX_RECOGNIZER_ERRORS) finishListening("error")
              else restartIfTimeLeft(delayMs = 500)
            }
          }
        }
      }

  private fun finishListening(result: String) {
    main.removeCallbacks(listenTimeout)
    recognizer?.let {
      it.cancel()
      it.destroy()
    }
    recognizer = null
    val promise = listenPromise
    listenPromise = null
    promise?.resolve(result)
  }

  // endregion

  // region Sounds and screen

  override fun playSound(name: String, promise: Promise) {
    main.post {
      stopSound()
      val resId = context.resources.getIdentifier(name, "raw", context.packageName)
      val created = if (resId != 0) MediaPlayer.create(context, resId) else null
      if (created == null) {
        promise.resolve(null)
        return@post
      }
      player = created
      soundPromise = promise
      created.setOnCompletionListener { stopSound() }
      created.start()
    }
  }

  private fun stopSound() {
    player?.release()
    player = null
    soundPromise?.resolve(null)
    soundPromise = null
  }

  override fun setKeepScreenOn(on: Boolean) {
    val activity = context.currentActivity ?: return
    activity.runOnUiThread {
      if (on) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  // endregion

  override fun invalidate() {
    main.post {
      finishListening("cancelled")
      stopSound()
      tts?.shutdown()
      tts = null
    }
    super.invalidate()
  }
}
