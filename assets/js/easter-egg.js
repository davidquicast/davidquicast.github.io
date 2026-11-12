/**
 * WipEout (1995) WebAssembly Easter Egg Controller
 * Self-hosted decompiled C port (sokol + WebAssembly + WebGL + QOA Audio)
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
    THRUST: 27, // X key (Accelerate / Select)
    SHOOT: 29, // Z key (Fire / Cancel)
    BRAKE_L: 6, // C key (Left Airbrake)
    BRAKE_R: 25, // V key (Right Airbrake)
    VIEW: 4, // A key (Change Camera)
    PAUSE: 40, // Enter key (Pause / Music Options)
  };

  var konamiIndex = 0;
  var avatarClicks = 0;
  var avatarClickTimer = null;
  var isWipEoutLoaded = false;
  var isWipEoutLoading = false;
  var gamepadLoopId = null;
  var activeGamepadState = {};
  var previousActiveElement = null;
  var trackToastTimer = null;

  var remainingTracksQueue = [
    { num: 2, name: "track02.qoa" },
    { num: 3, name: "track03.qoa" },
    { num: 4, name: "track04.qoa" },
    { num: 5, name: "track05.qoa" },
    { num: 6, name: "track06.qoa" },
    { num: 7, name: "track07.qoa" },
    { num: 8, name: "track08.qoa" },
    { num: 9, name: "track09.qoa" },
    { num: 10, name: "track10.qoa" },
    { num: 11, name: "track11.qoa" },
  ];

  function checkUrlTrigger() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.has("wipeout") || params.has("game") || params.has("antigravity")) {
        var cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
        setTimeout(launchWipEout, 300);
      }
    } catch (_) {}
  }

  function initEasterEgg() {
    checkUrlTrigger();
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
        "%c[AG-SYSTEMS]%c WipEout (1995) WebAssembly Easter Egg ready.\n" +
          "Ejecuta %cwindow.antigravity()%c o %cwindow.wipeout()%c para iniciar el juego.",
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
    window.wipeoutRestart = function () {
      restartWipEout();
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
      if (e && e.cancelable && e.type === "click") {
        // Prevent default zoom or synthetic delays on mobile
      }
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
      }, 2000);
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
    }, 2200);
  }

  function showTrackToast(trackName) {
    var toast = document.getElementById("wipeout-track-toast");
    var nameEl = document.getElementById("wipeout-track-name");
    if (!toast || !nameEl) return;

    nameEl.textContent = trackName.trim().toUpperCase();
    toast.hidden = false;

    clearTimeout(trackToastTimer);
    trackToastTimer = setTimeout(function () {
      toast.hidden = true;
    }, 4500);
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

  function restartWipEout() {
    stopGamepadLoop();
    suspendAudio();
    var modal = document.getElementById("wipeout-modal");
    if (modal && typeof modal.close === "function") {
      try {
        modal.close();
      } catch (_) {}
    }
    window.location.href = window.location.pathname + "?wipeout=1";
  }

  function handleEngineCrash(reason) {
    console.error("[WipEout] Engine crash caught:", reason);
    isWipEoutLoaded = false;
    isWipEoutLoading = false;
    stopGamepadLoop();

    var errorOverlay = document.getElementById("wipeout-error-overlay");
    var errorDesc = document.getElementById("wipeout-error-desc");
    if (errorOverlay) {
      errorOverlay.hidden = false;
    }
    if (errorDesc) {
      errorDesc.textContent =
        "Interrupción detectada en el motor WebAssembly (" +
        (typeof reason === "string" ? reason.slice(0, 120) : "Fallo de ejecución") +
        "). Puedes reiniciarlo limpiamente con un clic.";
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

    var errCloseBtn = modal.querySelector("[data-wipeout-error-close]");
    if (errCloseBtn) {
      errCloseBtn.addEventListener("click", function (e) {
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

    var restartBtn = modal.querySelector("[data-wipeout-restart]");
    if (restartBtn) {
      restartBtn.addEventListener("click", function (e) {
        e.preventDefault();
        restartWipEout();
      });
    }

    var retryBtn = modal.querySelector("[data-wipeout-retry]");
    if (retryBtn) {
      retryBtn.addEventListener("click", function (e) {
        e.preventDefault();
        restartWipEout();
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
        if (e && e.cancelable) e.preventDefault();
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

  function fetchRemainingTracksInBackground() {
    if (!remainingTracksQueue.length) return;
    var item = remainingTracksQueue.shift();

    fetch("/assets/games/wipeout/music/" + item.name)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.arrayBuffer();
      })
      .then(function (buffer) {
        if (window.Module && window.Module.FS) {
          try {
            window.Module.FS.writeFile("/wipeout/music/" + item.name, new Uint8Array(buffer));
            console.log("[WipEout Audio] Pista real lista en memoria: " + item.name);
          } catch (e) {}
        }
        setTimeout(fetchRemainingTracksInBackground, 800);
      })
      .catch(function (e) {
        console.warn("[WipEout Audio] Falló descarga de " + item.name + ", reteniendo placeholder.", e);
        setTimeout(fetchRemainingTracksInBackground, 2000);
      });
  }

  function handleEngineLog(text) {
    if (typeof text !== "string") return;
    var match = text.match(/open music track\s+([A-Z0-9\s]+)/i);
    if (match && match[1]) {
      showTrackToast(match[1]);
    }
  }

  function loadWipEoutEngine() {
    isWipEoutLoading = true;

    var loader = document.getElementById("wipeout-loader");
    var statusEl = document.getElementById("wipeout-status");
    var progressFill = document.getElementById("wipeout-progress-fill");
    var canvas = document.getElementById("canvas");

    if (loader) loader.style.display = "flex";
    if (statusEl) statusEl.textContent = "Cargando motor y pistas de audio...";

    window.Module = {
      canvas: canvas,
      preRun: [
        function () {
          try {
            window.Module.FS_createPath("/", "wipeout", true, true);
            window.Module.FS_createPath("/wipeout", "music", true, true);
          } catch (_) {}

          // Preload track01.qoa (Cairodrome) so sound is ready on first race start
          window.Module.FS_createPreloadedFile(
            "/wipeout/music",
            "track01.qoa",
            "/assets/games/wipeout/music/track01.qoa",
            true,
            true,
            function () {
              try {
                // Ensure slots 02 through 11 exist immediately as valid QOA to eliminate any NULL crash
                var t1 = window.Module.FS.readFile("/wipeout/music/track01.qoa");
                for (var i = 2; i <= 11; i++) {
                  var pad = i < 10 ? "0" + i : "" + i;
                  window.Module.FS.writeFile("/wipeout/music/track" + pad + ".qoa", t1);
                }
                fetchRemainingTracksInBackground();
              } catch (err) {
                console.warn("[WipEout Audio] Copia de resguardo completada:", err);
              }
            },
            function (err) {
              console.error("[WipEout Audio] Error al precargar track01.qoa:", err);
            }
          );
        },
      ],
      locateFile: function (path, prefix) {
        if (path.endsWith(".wasm") || path.endsWith(".data")) {
          return "/assets/games/wipeout/" + path;
        }
        return prefix + path;
      },
      print: function (text) {
        if (arguments.length > 1) {
          text = Array.prototype.slice.call(arguments).join(" ");
        }
        console.log(text);
        handleEngineLog(text);
      },
      printErr: function (text) {
        if (arguments.length > 1) {
          text = Array.prototype.slice.call(arguments).join(" ");
        }
        console.error(text);
        if (typeof text === "string" && text.indexOf("Abort") !== -1) {
          handleEngineCrash(text);
        }
      },
      onAbort: function (reason) {
        handleEngineCrash(reason);
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
            ? "Descargando datos y audio (" + (this.totalDependencies - left) + "/" + this.totalDependencies + ")..."
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
        statusEl.textContent = "Error al descargar WipEout. Reintente más tarde.";
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
