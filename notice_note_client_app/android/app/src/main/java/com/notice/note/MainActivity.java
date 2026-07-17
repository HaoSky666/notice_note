package com.notice.note;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (getBridge() != null) {
            getBridge().getWebView().addJavascriptInterface(new NoticeNoteAndroidBridge(), "NoticeNoteAndroid");
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                dispatchMobileBackEvent();
            }
        });
    }

    private void dispatchMobileBackEvent() {
        if (getBridge() == null) {
            finish();
            return;
        }

        getBridge().triggerWindowJSEvent("notice-note-mobile-back");
    }

    public class NoticeNoteAndroidBridge {
        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(() -> {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                    finishAndRemoveTask();
                    return;
                }
                finish();
            });
        }
    }
}
