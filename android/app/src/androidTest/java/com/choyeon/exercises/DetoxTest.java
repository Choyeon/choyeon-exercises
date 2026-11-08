package com.choyeon.exercises;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.rule.ActivityTestRule;

import com.wix.detox.Detox;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Detox 测试入口 — Detox 通过此 JUnit test 启动原生测试服务，
 * 然后由 Node.js 端的 Detox 测试脚本通过 WebSocket 与之通信，
 * 实现真实的触摸事件注入（绕过 react-native-gesture-handler 的限制）。
 */
@RunWith(AndroidJUnit4.class)
public class DetoxTest {

    @Rule
    public ActivityTestRule<MainActivity> mActivityRule =
            new ActivityTestRule<>(MainActivity.class, false, false);

    @Test
    public void runDetoxTests() {
        Detox.runTests(mActivityRule);
    }
}
