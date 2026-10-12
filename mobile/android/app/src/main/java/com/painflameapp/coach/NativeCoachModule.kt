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
import com.painflameapp.R
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
    // A recogniser session that ends sooner than this counts as a "fast failure".
    private const val FAST_FAILURE_MS = 1500L
    private const val RESTART_DELAY_MS = 300L
    private const val MAX_BACKOFF_MS = 2000L
    // Added in Android 12 (API 31); older phones never report them.
    private const val ERROR_LANGUAGE_NOT_SUPPORTED = 12
    private const val ERROR_LANGUAGE_UNAVAILABLE = 13
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
  private var sessionStartedAt = 0L
  private var backoffMs = RESTART_DELAY_MS
  // Some phones (often Android 11/12) have no offline speech pack: then use the online one.
  private var preferOffline = true
  private var language = "en-IN"
  private val listenTimeout = Runnable { finishListening("timeout") }
  private val restartRunnable = Runnable { startRecognizer() }

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
      backoffMs = RESTART_DELAY_MS
      listenDeadline = SystemClock.elapsedRealtime() + windowMs.toLong()
      main.postDelayed(listenTimeout, windowMs.toLong())
      startRecognizer()
    }
  }

  override fun stopListening() {
    main.post { finishListening("cancelled") }
  }

  /**
   * Starts one recognition session. The same recogniser is reused for every session in a
   * listening window: creating a new one each time makes older phones switch the
   * microphone on and off rapidly.
   */
  private fun startRecognizer() {
    if (listenPromise == null) return
    val active =
        recognizer
            ?: SpeechRecognizer.createSpeechRecognizer(context).also {
              it.setRecognitionListener(listener)
              recognizer = it
            }
    val remaining = (listenDeadline - SystemClock.elapsedRealtime()).coerceAtLeast(1000L)
    val intent =
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
          putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, preferOffline)
          putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
          // Ask the recogniser to keep listening through silence for the rest of the window,
          // instead of stopping after a second or two (honoured by most Google versions).
          putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, remaining)
          putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, remaining)
          putExtra(
              RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, remaining)
        }
    sessionStartedAt = SystemClock.elapsedRealtime()
    active.startListening(intent)
  }

  /**
   * The recogniser stops after each phrase or silence; restart it until the window ends.
   * If sessions keep ending almost immediately, wait longer between restarts (up to 2 s)
   * so the microphone doesn't flicker on and off.
   */
  private fun restartIfTimeLeft() {
    if (listenPromise == null) return
    val sessionLength = SystemClock.elapsedRealtime() - sessionStartedAt
    val delay =
        if (sessionLength < FAST_FAILURE_MS) {
          backoffMs.also { backoffMs = (backoffMs * 2).coerceAtMost(MAX_BACKOFF_MS) }
        } else {
          backoffMs = RESTART_DELAY_MS
          RESTART_DELAY_MS
        }
    if (SystemClock.elapsedRealtime() + delay < listenDeadline - 500) {
      main.removeCallbacks(restartRunnable)
      main.postDelayed(restartRunnable, delay)
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
          if (listenPromise == null) return // late callback after we stopped listening
          when (error) {
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> finishListening("permission")
            SpeechRecognizer.ERROR_NO_MATCH,
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> restartIfTimeLeft()
            ERROR_LANGUAGE_NOT_SUPPORTED,
            ERROR_LANGUAGE_UNAVAILABLE -> {
              // No offline pack for Indian English: try online, then plain English.
              if (preferOffline) preferOffline = false else language = "en-US"
              restartIfTimeLeft()
            }
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> {
              recognizer?.cancel()
              restartIfTimeLeft()
            }
            else -> {
              // e.g. ERROR_CLIENT / ERROR_SERVER on older phones: start over with a new recogniser.
              recognizerErrors++
              recognizer?.destroy()
              recognizer = null
              if (recognizerErrors >= MAX_RECOGNIZER_ERRORS) finishListening("error")
              else restartIfTimeLeft()
            }
          }
        }
      }

  private fun finishListening(result: String) {
    main.removeCallbacks(listenTimeout)
    main.removeCallbacks(restartRunnable)
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
      val resId =
          when (name) {
            "whistle" -> R.raw.whistle
            "bell" -> R.raw.bell
            else -> 0
          }
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
