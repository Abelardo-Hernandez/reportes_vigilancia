package com.puntotextil.reportesvigilancia;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;

import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.WindowCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, true);
        window.setStatusBarColor(Color.rgb(238, 242, 241));
        window.setNavigationBarColor(Color.rgb(238, 242, 241));
        window.getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        );
        aplicarEspacioSeguroAndroid();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(
                        "Boolean(window.manejarAtrasAndroid && window.manejarAtrasAndroid());",
                        resultado -> {
                            if (!"true".equals(resultado)) {
                                moveTaskToBack(true);
                            }
                        }
                    );
                }
            }
        });
    }

    private void aplicarEspacioSeguroAndroid() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        View webView = getBridge().getWebView();
        webView.post(() -> inyectarEspacioSeguroAndroid(webView, 44, 0));
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets barras = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            float density = getResources().getDisplayMetrics().density;
            int arriba = Math.max(Math.round(barras.top / density), 44);
            int abajo = Math.round(barras.bottom / density);
            inyectarEspacioSeguroAndroid(view, arriba, abajo);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(webView);
    }

    private void inyectarEspacioSeguroAndroid(View view, int arriba, int abajo) {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        String script = "(function(){"
            + "document.body.classList.add('android-shell');"
            + "document.documentElement.style.setProperty('--android-top-safe-space','" + arriba + "px');"
            + "document.documentElement.style.setProperty('--android-bottom-safe-space','" + abajo + "px');"
            + "})();";
        getBridge().getWebView().evaluateJavascript(script, null);
    }
}
