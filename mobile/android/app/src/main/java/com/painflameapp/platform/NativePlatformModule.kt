package com.painflameapp.platform

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import androidx.core.content.ContextCompat
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.painflameapp.specs.NativePlatformSpec

/** "Continue with Google" (Credential Manager) and downloads to the Downloads folder. */
class NativePlatformModule(private val context: ReactApplicationContext) :
    NativePlatformSpec(context) {

  companion object {
    const val NAME = "NativePlatform"
    private const val DOWNLOAD_FOLDER = "Painflame"
  }

  override fun getName() = NAME

  override fun googleSignIn(webClientId: String, nonce: String, promise: Promise) {
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject("failed", "The app is not in the foreground")
      return
    }
    // The "Sign in with Google" flow shows every Google account on the phone.
    val option = GetSignInWithGoogleOption.Builder(webClientId).setNonce(nonce).build()
    val request = GetCredentialRequest.Builder().addCredentialOption(option).build()

    CredentialManager.create(activity)
        .getCredentialAsync(
            activity,
            request,
            null,
            ContextCompat.getMainExecutor(activity),
            object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
              override fun onResult(result: GetCredentialResponse) {
                val credential = result.credential
                if (credential is CustomCredential &&
                    credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                  val google = GoogleIdTokenCredential.createFrom(credential.data)
                  promise.resolve(
                      Arguments.createMap().apply {
                        putString("idToken", google.idToken)
                        putString("email", google.id)
                        putString("name", google.displayName)
                      })
                } else {
                  promise.reject("failed", "Unexpected sign-in result")
                }
              }

              override fun onError(e: GetCredentialException) {
                when (e) {
                  is GetCredentialCancellationException -> promise.reject("cancelled", e.message, e)
                  is NoCredentialException -> promise.reject("no_account", e.message, e)
                  else -> promise.reject("failed", e.message ?: e.type, e)
                }
              }
            })
  }

  override fun googleSignOut(promise: Promise) {
    CredentialManager.create(context)
        .clearCredentialStateAsync(
            ClearCredentialStateRequest(),
            null,
            ContextCompat.getMainExecutor(context),
            object : CredentialManagerCallback<Void?, ClearCredentialException> {
              override fun onResult(result: Void?) {
                promise.resolve(null)
              }

              override fun onError(e: ClearCredentialException) {
                promise.resolve(null) // nothing to forget is fine
              }
            })
  }

  override fun downloadFile(url: String, fileName: String, mimeType: String, promise: Promise) {
    try {
      val safeName = fileName.replace(Regex("[\\\\/:*?\"<>|]"), "_")
      val request =
          DownloadManager.Request(Uri.parse(url))
              .setTitle(safeName)
              .setDescription("Painflame Clinic report")
              .setMimeType(mimeType)
              .setNotificationVisibility(
                  DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
              // No storage permission is needed for Downloads on Android 10+.
              .setDestinationInExternalPublicDir(
                  Environment.DIRECTORY_DOWNLOADS, "$DOWNLOAD_FOLDER/$safeName")
      val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      manager.enqueue(request)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("failed", e.message, e)
    }
  }
}
