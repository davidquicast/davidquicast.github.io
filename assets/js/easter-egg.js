/**
 * WipEout (1995) WebAssembly Easter Egg Controller
 * Self-hosted decompiled C port (sokol + WebAssembly + WebGL)
 * Zero initial load overhead: assets lazy-loaded on activation.
 */
(function () {
  "use strict";

  var KONAMI_SEQUENCE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

  var BUTTON_CODES = {
    UP: 82,
    DOWN: 81,
    LEFT: 80,
    RIGHT: 79,
    THRUST: 27, // X key
    SHOOT: 29, // Z key
    BRAKE_L: 6, // C key
    BRAKE_R: 25, // V key
    VIEW: 4, // A key
    PAUSE: 40, // Enter key
  };

  var konamiIndex = 0;
  var avatarClicks = 0;
  var avatarClickTimer = null;
  var isWipEoutLoaded = false;
  var isWipEoutLoading = false;
  var gamepadLoopId = null;
  var activeGamepadState = {};
  var previousActiveElement = null;

  function initEasterEgg() {
    setupKonamiListener();
    setupAvatarListener();
    setupGlobalApi();
    setupModalEvents();
    setupTouchControls();
    logConsoleGreeting();
  }

  function logConsoleGreeting() {
    try {
      console.log(
        "%c[AG-SYSTEMS]%c WipEout (1995) WebAssembly easter egg loaded.\n" + "Execute %cwindow.antigravity()%c or %cwindow.wipeout()%c to launch.",
        "background: #00f0ff; color: #040910; font-weight: bold; padding: 2px 6px; border-radius: 3px;",
        "color: #00f0ff;",
        "color: #ffd000; font-weight: bold;",
        "color: #00f0ff;",
        "color: #ffd000; font-weight: bold;",
        "color: #00f0ff;"
      );
    } catch (_) {}
  }

  function setupGlobalApi() {
    window.antigravity = window.wipeout = function () {
      launchWipEout();
    };
  }

  function setupKonamiListener() {
    document.addEventListener("keydown", function (e) {
      var active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
        return;
      }

      var key = e.key;
      var expected = KONAMI_SEQUENCE[konamiIndex];

      if (key === expected || (expected.length === 1 && key.toLowerCase() === expected)) {
        konamiIndex++;
        if (konamiIndex === KONAMI_SEQUENCE.length) {
          konamiIndex = 0;
          launchWipEout();
        }
      } else {
        konamiIndex = 0;
        if (key === KONAMI_SEQUENCE[0]) {
          konamiIndex = 1;
        }
      }
    });
  }

  function setupAvatarListener() {
    function handleAvatarClick(e) {
      avatarClicks++;
      clearTimeout(avatarClickTimer);

      var avatarEl = e.currentTarget;

      if (avatarClicks >= 3 && avatarClicks < 5 && avatarEl) {
        avatarEl.classList.remove("egg-pulse");
        void avatarEl.offsetWidth;
        avatarEl.classList.add("egg-pulse");
      }

      if (avatarClicks >= 5) {
        avatarClicks = 0;
        if (avatarEl) {
          avatarEl.classList.remove("egg-pulse");
        }
        launchWipEout();
        return;
      }

      avatarClickTimer = setTimeout(function () {
        avatarClicks = 0;
        if (avatarEl) {
          avatarEl.classList.remove("egg-pulse");
        }
      }, 1600);
    }

    var avatars = document.querySelectorAll(".profile-avatar, [data-easter-egg-trigger], .profile-portrait");
    avatars.forEach(function (avatar) {
      avatar.addEventListener("click", handleAvatarClick);
      avatar.setAttribute("title", "David Quispe");
    });
  }

  function showNotificationBanner() {
    var banner = document.getElementById("wipeout-easter-egg-banner");
    if (!banner) return;
    banner.hidden = false;
    setTimeout(function () {
      banner.hidden = true;
    }, 2000);
  }

  function launchWipEout() {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;

    previousActiveElement = document.activeElement;
    showNotificationBanner();

    if (typeof modal.showModal === "function") {
      if (!modal.open) {
        modal.showModal();
      }
    } else {
      modal.setAttribute("open", "");
    }

    document.body.style.overflow = "hidden";

    if (isWipEoutLoaded) {
      resumeAudioIfSuspended();
      focusCanvas();
      startGamepadLoop();
      return;
    }

    if (isWipEoutLoading) return;

    loadWipEoutEngine();
  }

  function closeWipEout() {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;

    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }

    suspendAudio();
    stopGamepadLoop();

    if (typeof modal.close === "function") {
      if (modal.open) {
        modal.close();
      }
    } else {
      modal.removeAttribute("open");
    }

    document.body.style.overflow = "";

    if (previousActiveElement && typeof previousActiveElement.focus === "function") {
      try {
        previousActiveElement.focus();
      } catch (_) {}
    }
  }

  function suspendAudio() {
    try {
      if (window.Module && window.Module._saudio_context && window.Module._saudio_context.state === "running") {
        window.Module._saudio_context.suspend();
      }
    } catch (_) {}
  }

  function resumeAudioIfSuspended() {
    try {
      if (window.Module && window.Module._saudio_context && window.Module._saudio_context.state === "suspended") {
        window.Module._saudio_context.resume();
      }
    } catch (_) {}
  }

  function toggleAudioMute() {
    try {
      var audioCtx = window.Module && window.Module._saudio_context;
      var audioBtn = document.querySelector("[data-wipeout-audio]");
      var iconOn = audioBtn ? audioBtn.querySelector(".audio-on-icon") : null;
      var iconOff = audioBtn ? audioBtn.querySelector(".audio-off-icon") : null;

      if (!audioCtx) return;

      if (audioCtx.state === "running") {
        audioCtx.suspend();
        if (iconOn) iconOn.style.display = "none";
        if (iconOff) iconOff.style.display = "inline-block";
        if (audioBtn) audioBtn.setAttribute("aria-label", "Activar sonido");
      } else {
        audioCtx.resume();
        if (iconOn) iconOn.style.display = "inline-block";
        if (iconOff) iconOff.style.display = "none";
        if (audioBtn) audioBtn.setAttribute("aria-label", "Silenciar sonido");
      }
    } catch (_) {}
  }

  function toggleFullscreen() {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;
    var target = modal.querySelector(".wipeout-frame") || modal;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(function () {});
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  function focusCanvas() {
    var canvas = document.getElementById("canvas");
    if (canvas) {
      try {
        canvas.focus();
      } catch (_) {}
    }
  }

  function setGameButton(code, pressed) {
    if (window.Module && typeof window.Module._set_button === "function") {
      try {
        window.Module._set_button(code, pressed ? 1 : 0);
      } catch (_) {}
    }
  }

  function setupModalEvents() {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;

    var closeBtn = modal.querySelector("[data-wipeout-close]");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeWipEout();
      });
    }

    var audioBtn = modal.querySelector("[data-wipeout-audio]");
    if (audioBtn) {
      audioBtn.addEventListener("click", function (e) {
        e.preventDefault();
        toggleAudioMute();
      });
    }

    var fsBtn = modal.querySelector("[data-wipeout-fullscreen]");
    if (fsBtn) {
      fsBtn.addEventListener("click", function (e) {
        e.preventDefault();
        toggleFullscreen();
      });
    }

    var helpBtn = modal.querySelector("[data-wipeout-help]");
    var helpOverlay = document.getElementById("wipeout-help-overlay");
    if (helpBtn && helpOverlay) {
      helpBtn.addEventListener("click", function (e) {
        e.preventDefault();
        helpOverlay.hidden = !helpOverlay.hidden;
      });
    }

    var helpDismiss = modal.querySelector("[data-wipeout-help-dismiss]");
    if (helpDismiss && helpOverlay) {
      helpDismiss.addEventListener("click", function (e) {
        e.preventDefault();
        helpOverlay.hidden = true;
        focusCanvas();
      });
    }

    modal.addEventListener("cancel", function (e) {
      e.preventDefault();
      closeWipEout();
    });

    modal.addEventListener("close", function () {
      closeWipEout();
    });

    document.addEventListener("keydown", function (e) {
      if (modal.open && e.key === "Escape") {
        if (helpOverlay && !helpOverlay.hidden) {
          helpOverlay.hidden = true;
          focusCanvas();
          e.stopPropagation();
          return;
        }
        closeWipEout();
      }
    });
  }

  function setupTouchControls() {
    var buttons = document.querySelectorAll(".wipeout-touch-controls [data-button]");

    buttons.forEach(function (button) {
      var code = parseInt(button.getAttribute("data-button"), 10);
      if (isNaN(code)) return;

      function press(e) {
        if (e.cancelable) e.preventDefault();
        button.classList.add("active");
        setGameButton(code, 1);
        resumeAudioIfSuspended();
      }

      function release(e) {
        if (e && e.cancelable) e.preventDefault();
        button.classList.remove("active");
        setGameButton(code, 0);
      }

      if (window.PointerEvent) {
        button.addEventListener("pointerdown", function (e) {
          try {
            button.setPointerCapture(e.pointerId);
          } catch (_) {}
          press(e);
        });
        button.addEventListener("pointerup", function (e) {
          try {
            button.releasePointerCapture(e.pointerId);
          } catch (_) {}
          release(e);
        });
        button.addEventListener("pointercancel", release);
      } else {
        button.addEventListener("touchstart", press, { passive: false });
        button.addEventListener("touchend", release, { passive: false });
        button.addEventListener("touchcancel", release, { passive: false });
        button.addEventListener("mousedown", press);
        button.addEventListener("mouseup", release);
        button.addEventListener("mouseleave", release);
      }
    });
  }

  function startGamepadLoop() {
    if (!("getGamepads" in navigator)) return;
    if (gamepadLoopId !== null) return;

    function pollGamepad() {
      var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      var gp = null;
      for (var i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          gp = gamepads[i];
          break;
        }
      }

      if (gp && window.Module && typeof window.Module._set_button === "function") {
        var buttons = gp.buttons;
        var axes = gp.axes;

        var dpadUp = (buttons[12] && buttons[12].pressed) || (axes[1] && axes[1] < -0.4);
        var dpadDown = (buttons[13] && buttons[13].pressed) || (axes[1] && axes[1] > 0.4);
        var dpadLeft = (buttons[14] && buttons[14].pressed) || (axes[0] && axes[0] < -0.4);
        var dpadRight = (buttons[15] && buttons[15].pressed) || (axes[0] && axes[0] > 0.4);

        var thrust = (buttons[0] && buttons[0].pressed) || (buttons[1] && buttons[1].pressed); // A / B
        var shoot = (buttons[2] && buttons[2].pressed) || (buttons[3] && buttons[3].pressed); // X / Y
        var brakeL = (buttons[4] && buttons[4].pressed) || (buttons[6] && buttons[6].pressed); // LB / LT
        var brakeR = (buttons[5] && buttons[5].pressed) || (buttons[7] && buttons[7].pressed); // RB / RT
        var pause = buttons[9] && buttons[9].pressed; // Start
        var view = buttons[8] && buttons[8].pressed; // Select / Back

        updateGpButton(BUTTON_CODES.UP, dpadUp);
        updateGpButton(BUTTON_CODES.DOWN, dpadDown);
        updateGpButton(BUTTON_CODES.LEFT, dpadLeft);
        updateGpButton(BUTTON_CODES.RIGHT, dpadRight);
        updateGpButton(BUTTON_CODES.THRUST, thrust);
        updateGpButton(BUTTON_CODES.SHOOT, shoot);
        updateGpButton(BUTTON_CODES.BRAKE_L, brakeL);
        updateGpButton(BUTTON_CODES.BRAKE_R, brakeR);
        updateGpButton(BUTTON_CODES.PAUSE, pause);
        updateGpButton(BUTTON_CODES.VIEW, view);
      }

      var modal = document.getElementById("wipeout-modal");
      if (modal && modal.open) {
        gamepadLoopId = requestAnimationFrame(pollGamepad);
      } else {
        gamepadLoopId = null;
      }
    }

    gamepadLoopId = requestAnimationFrame(pollGamepad);
  }

  function updateGpButton(code, isPressed) {
    var wasPressed = !!activeGamepadState[code];
    if (isPressed !== wasPressed) {
      activeGamepadState[code] = isPressed;
      setGameButton(code, isPressed ? 1 : 0);
    }
  }

  function stopGamepadLoop() {
    if (gamepadLoopId !== null) {
      cancelAnimationFrame(gamepadLoopId);
      gamepadLoopId = null;
    }
    for (var code in activeGamepadState) {
      if (activeGamepadState[code]) {
        setGameButton(parseInt(code, 10), 0);
      }
    }
    activeGamepadState = {};
  }

  function loadWipEoutEngine() {
    isWipEoutLoading = true;

    var loader = document.getElementById("wipeout-loader");
    var statusEl = document.getElementById("wipeout-status");
    var progressFill = document.getElementById("wipeout-progress-fill");
    var canvas = document.getElementById("canvas");

    if (loader) loader.style.display = "flex";
    if (statusEl) statusEl.textContent = "Descargando motor y texturas...";

    window.Module = {
      canvas: canvas,
      locateFile: function (path, prefix) {
        if (path.endsWith(".wasm") || path.endsWith(".data")) {
          return "/assets/games/wipeout/" + path;
        }
        return prefix + path;
      },
      setStatus: function (text) {
        if (!text) {
          if (loader) loader.style.display = "none";
          return;
        }
        if (statusEl) statusEl.textContent = text;
        var match = text.match(/([0-9]+)\/([0-9]+)/);
        if (match && progressFill) {
          var pct = Math.round((parseInt(match[1], 10) / parseInt(match[2], 10)) * 100);
          progressFill.style.width = pct + "%";
        }
      },
      totalDependencies: 0,
      monitorRunDependencies: function (left) {
        this.totalDependencies = Math.max(this.totalDependencies, left);
        if (statusEl) {
          statusEl.textContent = left
            ? "Cargando datos (" + (this.totalDependencies - left) + "/" + this.totalDependencies + ")..."
            : "Inicializando motor WipEout...";
        }
        if (progressFill && this.totalDependencies > 0) {
          var pct = Math.round(((this.totalDependencies - left) / this.totalDependencies) * 100);
          progressFill.style.width = pct + "%";
        }
      },
      onRuntimeInitialized: function () {
        isWipEoutLoaded = true;
        isWipEoutLoading = false;
        if (loader) loader.style.display = "none";
        focusCanvas();
        startGamepadLoop();
      },
    };

    var script = document.createElement("script");
    script.src = "/assets/games/wipeout/wipeout-minimal.js";
    script.async = true;
    script.onerror = function () {
      isWipEoutLoading = false;
      if (statusEl) {
        statusEl.textContent = "Error al cargar WipEout. Reintente más tarde.";
      }
    };
    document.body.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEasterEgg);
  } else {
    initEasterEgg();
  }
})();
