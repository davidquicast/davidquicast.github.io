/**
 * Retro Arcade Easter Egg Controller
 * Dual Engine:
 * 1. Aero Fighters (SNES - 1993) [PRIMARY]: WebAssembly Snes9x + SPC700 synthesized audio + Virtual Analog Joystick
 * 2. WipEout (1995) [FALLBACK / SECONDARY]: Decompiled C + Sokol WebAssembly + QOA CD-Audio
 *
 * Zero performance impact on portfolio initial page load (lazy-loaded).
 */
(function () {
  "use strict";

  var KONAMI_SEQUENCE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

  var currentEngine = "aerofighters"; // "aerofighters" (default) or "wipeout"
  var snesInstance = null;
  var isWipEoutLoaded = false;
  var isWipEoutLoading = false;
  var isAudioMuted = false;
  var autoFireActive = false;
  var autoFireInterval = null;
  var activeGamepadState = {};
  var gamepadLoopId = null;
  var previousActiveElement = null;
  var trackToastTimer = null;
  var activeAudioContexts = [];

  // Track WebAudio contexts created by WebAssembly modules
  var OrigAudioCtx = window.AudioContext || window.webkitAudioContext;
  if (OrigAudioCtx) {
    var PatchedAudioCtx = function () {
      var ctx = new OrigAudioCtx();
      activeAudioContexts.push(ctx);
      if (isAudioMuted) {
        try {
          ctx.suspend();
        } catch (_) {}
      }
      return ctx;
    };
    PatchedAudioCtx.prototype = OrigAudioCtx.prototype;
    try {
      window.AudioContext = PatchedAudioCtx;
      if (window.webkitAudioContext) window.webkitAudioContext = PatchedAudioCtx;
    } catch (_) {}
  }

  var konamiIndex = 0;
  var avatarClicks = 0;
  var avatarClickTimer = null;

  var activeDirs = { up: false, down: false, left: false, right: false };

  // WipEout button codes for C engine
  var BUTTON_CODES = {
    UP: 82,
    DOWN: 81,
    LEFT: 80,
    RIGHT: 79,
    THRUST: 27,
    SHOOT: 29,
    BRAKE_L: 6,
    BRAKE_R: 25,
    VIEW: 4,
    PAUSE: 40,
  };

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
      if (params.has("game") || params.has("aerofighters") || params.has("antigravity")) {
        var cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
        setTimeout(launchAeroFighters, 300);
      } else if (params.has("wipeout")) {
        var cleanUrlW = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrlW);
        setTimeout(launchWipEout, 300);
      }
    } catch (_) {}
  }

  function initEasterEgg() {
    checkUrlTrigger();
    setupKonamiListener();
    setupAvatarListener();
    setupModalEvents();
    setupVirtualJoystick();
    setupTouchButtons();
    setupAeroFightersKeyboard();

    window.antigravity = function () {
      launchAeroFighters();
      return "AG-SYSTEMS: Aero Fighters (SNES) iniciado.";
    };
    window.aerofighters = function () {
      launchAeroFighters();
      return "AG-SYSTEMS: Aero Fighters (SNES) iniciado.";
    };
    window.wipeout = function () {
      launchWipEout();
      return "AG-SYSTEMS: WipEout (1995) iniciado.";
    };

    console.log(
      "%c[AG-SYSTEMS]%c Retro Arcade Easter Egg ready.\nEjecuta %cwindow.antigravity()%c o %cwindow.wipeout()%c para jugar.",
      "background: #00f0ff; color: #040910; font-weight: bold; padding: 2px 6px; border-radius: 3px;",
      "color: #00f0ff;",
      "color: #ffd000; font-weight: bold;",
      "color: #00f0ff;",
      "color: #ffd000; font-weight: bold;",
      "color: #00f0ff;"
    );
  }

  function setupKonamiListener() {
    document.addEventListener("keydown", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      var expected = KONAMI_SEQUENCE[konamiIndex];
      var key = e.key;
      if (key.length === 1) key = key.toLowerCase();

      if (key === expected.toLowerCase() || key === expected) {
        konamiIndex++;
        if (konamiIndex === KONAMI_SEQUENCE.length) {
          konamiIndex = 0;
          launchAeroFighters();
        }
      } else {
        konamiIndex = 0;
      }
    });
  }

  function setupAvatarListener() {
    var avatar = document.querySelector(".profile-avatar");
    if (!avatar) return;

    avatar.addEventListener("click", function (e) {
      avatarClicks++;
      avatar.classList.add("egg-pulse");
      clearTimeout(avatarClickTimer);

      if (avatarClicks >= 5) {
        avatarClicks = 0;
        avatar.classList.remove("egg-pulse");
        launchAeroFighters();
        return;
      }

      avatarClickTimer = setTimeout(function () {
        avatarClicks = 0;
        avatar.classList.remove("egg-pulse");
      }, 1500);
    });
  }

  function flashBanner(text) {
    var banner = document.getElementById("wipeout-easter-egg-banner");
    var label = document.getElementById("easter-egg-banner-text");
    if (!banner) return;
    if (label && text) label.textContent = text;
    banner.hidden = false;
    setTimeout(function () {
      banner.hidden = true;
    }, 2800);
  }

  function showLoader(visible, statusText, pct) {
    var loader = document.getElementById("wipeout-loader");
    var statusEl = document.getElementById("wipeout-status");
    var fillEl = document.getElementById("wipeout-progress-fill");
    if (!loader) return;

    if (visible) {
      loader.removeAttribute("hidden");
      loader.style.display = "flex";
      if (statusEl && statusText) statusEl.textContent = statusText;
      if (fillEl && typeof pct === "number") fillEl.style.width = pct + "%";
    } else {
      loader.setAttribute("hidden", "");
      loader.style.display = "none";
    }
  }

  function updateLoaderProgress(pct, statusText) {
    var fillEl = document.getElementById("wipeout-progress-fill");
    var statusEl = document.getElementById("wipeout-status");
    if (fillEl) fillEl.style.width = pct + "%";
    if (statusEl && statusText) statusEl.textContent = statusText;
  }

  function showToast(trackName, artistName) {
    var toast = document.getElementById("wipeout-track-toast");
    var nameEl = document.getElementById("wipeout-track-name");
    if (!toast || !nameEl) return;

    nameEl.textContent = trackName || "STAGE BGM";
    var artistEl = toast.querySelector(".track-artist");
    if (artistEl) artistEl.textContent = artistName || "SONY SPC700 // S-DSP";

    toast.hidden = false;
    toast.classList.remove("toast-out");
    toast.classList.add("toast-in");

    clearTimeout(trackToastTimer);
    trackToastTimer = setTimeout(function () {
      toast.classList.remove("toast-in");
      toast.classList.add("toast-out");
      setTimeout(function () {
        toast.hidden = true;
      }, 300);
    }, 3800);
  }

  function showError(title, desc) {
    var overlay = document.getElementById("wipeout-error-overlay");
    var titleEl = document.getElementById("wipeout-error-title");
    var descEl = document.getElementById("wipeout-error-desc");
    if (!overlay) return;
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
    overlay.hidden = false;
    showLoader(false);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  function updateHeaderForEngine(engine) {
    var prefix = document.getElementById("easter-egg-tag-prefix");
    var title = document.getElementById("easter-egg-title");
    var badge = document.getElementById("easter-egg-badge");
    var switchLabel = document.getElementById("easter-egg-switch-label");
    var sub = document.getElementById("wipeout-loader-sub");
    var actionMain = document.getElementById("action-btn-main-label");
    var actionSub = document.getElementById("action-btn-sub-label");
    var bombMain = document.getElementById("action-btn-bomb-label");
    var bombSub = document.getElementById("action-btn-bomb-sub");

    if (engine === "aerofighters") {
      if (prefix) prefix.textContent = "SNES //";
      if (title) title.textContent = "AERO FIGHTERS (1993)";
      if (badge) badge.textContent = "SPC700 AUDIO // 60 FPS";
      if (switchLabel) switchLabel.textContent = "🏎️ WipEout";
      if (sub) sub.textContent = "Snes9x WebAssembly • 16-Bit SPC700 Audio • 60 FPS";
      if (actionMain) actionMain.textContent = "FUEGO";
      if (actionSub) actionSub.textContent = "DISPARO [B]";
      if (bombMain) bombMain.textContent = "BOMBA";
      if (bombSub) bombSub.textContent = "ESPECIAL [A]";
    } else {
      if (prefix) prefix.textContent = "AG-SYSTEMS //";
      if (title) title.textContent = "WIPEOUT (1995)";
      if (badge) badge.textContent = "WASM // 60 FPS";
      if (switchLabel) switchLabel.textContent = "✈️ Aero Fighters";
      if (sub) sub.textContent = "Decompilación C • WebAssembly • Audio QOA • Sokol Engine";
      if (actionMain) actionMain.textContent = "ACEL";
      if (actionSub) actionSub.textContent = "X / OK";
      if (bombMain) bombMain.textContent = "FUEGO";
      if (bombSub) bombSub.textContent = "Z / ARMA";
    }
  }

  /* -------------------------------------------------------------
   * Aero Fighters Engine (WebAssembly Snes9x + SPC700 Sound)
   * ------------------------------------------------------------- */
  async function launchAeroFighters() {
    currentEngine = "aerofighters";
    updateHeaderForEngine("aerofighters");

    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;

    if (!modal.open) {
      previousActiveElement = document.activeElement;
      modal.showModal();
      flashBanner("AG-SYSTEMS // AERO FIGHTERS (SNES) ACTIVADO");
    }

    // If snesInstance is already running, just resume
    if (snesInstance) {
      showLoader(false);
      try {
        snesInstance.resume();
      } catch (_) {}
      focusCanvas();
      return;
    }

    showLoader(true, "Iniciando emulador y música SNES...", 25);

    try {
      if (typeof window.Nostalgist === "undefined") {
        updateLoaderProgress(50, "Cargando motor WebAssembly...");
        await loadScript("/assets/games/snes/nostalgist.umd.js");
      }

      updateLoaderProgress(75, "Inicializando procesador de sonido SPC700...");

      var canvas = document.getElementById("canvas");

      snesInstance = await window.Nostalgist.launch({
        core: "snes9x2005",
        rom: "/assets/games/snes/aero-fighters.sfc",
        element: canvas,
        resolveRom: function (r) {
          return r;
        },
        resolveCoreJs: function () {
          return "/assets/games/snes/snes9x2005_libretro.js";
        },
        resolveCoreWasm: function () {
          return "/assets/games/snes/snes9x2005_libretro.wasm";
        },
        retroarchConfig: {
          video_smooth: false,
          audio_enable: true,
        },
      });

      showLoader(false);
      focusCanvas();

      if (isAudioMuted) {
        activeAudioContexts.forEach(function (c) {
          try {
            c.suspend();
          } catch (_) {}
        });
      }

      showToast("AERO FIGHTERS", "SUPER NINTENDO // SPC700 BGM");
    } catch (err) {
      console.error("Aero Fighters launch error:", err);
      showError("Error al iniciar Aero Fighters", err && err.message ? err.message : String(err));
    }
  }

  /* -------------------------------------------------------------
   * WipEout 1995 Engine (Fallback / Alternative)
   * ------------------------------------------------------------- */
  function launchWipEout() {
    currentEngine = "wipeout";
    updateHeaderForEngine("wipeout");

    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;

    if (!modal.open) {
      previousActiveElement = document.activeElement;
      modal.showModal();
      flashBanner("AG-SYSTEMS // WIPEOUT (1995) ACTIVADO");
    }

    if (isWipEoutLoaded) {
      focusCanvas();
      return;
    }

    if (isWipEoutLoading) return;
    isWipEoutLoading = true;
    showLoader(true, "Cargando motor WipEout...", 15);

    var preloadP = fetchTrack("/assets/games/wipeout/music/track01.qoa");
    preloadP
      .then(function (track01Bytes) {
        updateLoaderProgress(50, "Inicializando WebAssembly y Sokol WebGL...");
        setupModule(track01Bytes);
        return loadWipEoutEngineScript();
      })
      .then(function () {
        isWipEoutLoaded = true;
        isWipEoutLoading = false;
        showLoader(false);
        focusCanvas();
        startGamepadPolling();
        showToast("CAIRODROME", "CoLD SToRAGE (Track 01)");
        startBackgroundTrackDownloads();
      })
      .catch(function (err) {
        isWipEoutLoading = false;
        console.error("WipEout load failed:", err);
        showError("Fallo al iniciar WipEout", err && err.message ? err.message : String(err));
      });
  }

  function fetchTrack(url) {
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " on " + url);
        return res.arrayBuffer();
      })
      .then(function (ab) {
        return new Uint8Array(ab);
      });
  }

  function setupModule(track01Bytes) {
    window.Module = {
      canvas: document.getElementById("canvas"),
      arguments: [],
      print: function (text) {
        handleEngineLog(text);
      },
      printErr: function (text) {
        if (text && text.indexOf("Invalid music index") !== -1) {
          console.warn("[WipEout Audio Guard]:", text);
          return;
        }
        console.error("[WipEout Error]:", text);
      },
      preRun: [
        function () {
          try {
            if (window.FS) {
              window.Module.FS_createPath("/", "wipeout", true, true);
              window.Module.FS_createPath("/wipeout", "music", true, true);
              if (track01Bytes && track01Bytes.length > 0) {
                window.FS.writeFile("/wipeout/music/track01.qoa", track01Bytes);
                for (var i = 2; i <= 11; i++) {
                  var padNum = i < 10 ? "0" + i : "" + i;
                  window.FS.writeFile("/wipeout/music/track" + padNum + ".qoa", track01Bytes);
                }
              }
            }
          } catch (e) {
            console.warn("preRun FS init warn:", e);
          }
        },
      ],
      postRun: [
        function () {
          showLoader(false);
          focusCanvas();
        },
      ],
      onAbort: function (err) {
        showError("Interrupción de WipEout", String(err));
      },
    };
  }

  function loadWipEoutEngineScript() {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src*="wipeout-minimal.js"]')) {
        resolve();
        return;
      }
      var s = document.createElement("script");
      s.src = "/assets/games/wipeout/wipeout-minimal.js";
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  function startBackgroundTrackDownloads() {
    var queue = remainingTracksQueue.slice();
    function downloadNext() {
      if (queue.length === 0) return;
      var item = queue.shift();
      var padNum = item.num < 10 ? "0" + item.num : "" + item.num;
      var trackPath = "/wipeout/music/track" + padNum + ".qoa";
      fetchTrack("/assets/games/wipeout/music/" + item.name)
        .then(function (bytes) {
          if (window.Module && window.Module.FS) {
            try {
              window.Module.FS.writeFile(trackPath, bytes);
            } catch (_) {}
          }
          setTimeout(downloadNext, 500);
        })
        .catch(function () {
          setTimeout(downloadNext, 1000);
        });
    }
    setTimeout(downloadNext, 2000);
  }

  function handleEngineLog(text) {
    if (!text) return;
    var match = text.match(/open music track:.*track(\d+)\.qoa/i);
    if (match && match[1]) {
      var trackNum = parseInt(match[1], 10);
      var names = [
        "",
        "CAIRODROME",
        "TRANSRAPID",
        "AFRO RIDE",
        "LANDMATE",
        "CORRIDOR",
        "OPERATIQUE",
        "MESSIJ EXTENDED",
        "DO RE MI",
        "WIPEOUT TITLES",
        "CODON",
        "HALCYON",
      ];
      showToast(names[trackNum] || "TRACK " + trackNum, "CoLD SToRAGE");
    }
  }

  /* -------------------------------------------------------------
   * Virtual Analog Joystick Module
   * ------------------------------------------------------------- */
  function setupVirtualJoystick() {
    var base = document.getElementById("touch-joystick-base");
    var knob = document.getElementById("touch-joystick-knob");
    if (!base || !knob) return;

    var activePointerId = null;
    var maxRadius = 38;

    function getBaseCenter() {
      var rect = base.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    function applyDirection(dir, pressed) {
      if (currentEngine === "aerofighters" && snesInstance) {
        if (pressed) {
          try {
            snesInstance.pressDown(dir);
          } catch (_) {}
        } else {
          try {
            snesInstance.pressUp(dir);
          } catch (_) {}
        }
      } else if (currentEngine === "wipeout") {
        var code = dir === "up" ? 82 : dir === "down" ? 81 : dir === "left" ? 80 : 79;
        setGameButton(code, pressed);
      }
    }

    function updateJoystick(clientX, clientY) {
      var center = getBaseCenter();
      var dx = clientX - center.x;
      var dy = clientY - center.y;
      var dist = Math.hypot(dx, dy);

      var clampedDist = Math.min(dist, maxRadius);
      var angle = Math.atan2(dy, dx);
      var knobX = Math.cos(angle) * clampedDist;
      var knobY = Math.sin(angle) * clampedDist;

      knob.style.transform = "translate3d(" + knobX + "px, " + knobY + "px, 0)";

      var deadzone = 8;
      var newLeft = dx < -deadzone;
      var newRight = dx > deadzone;
      var newUp = dy < -deadzone;
      var newDown = dy > deadzone;

      if (newLeft !== activeDirs.left) {
        activeDirs.left = newLeft;
        applyDirection("left", newLeft);
      }
      if (newRight !== activeDirs.right) {
        activeDirs.right = newRight;
        applyDirection("right", newRight);
      }
      if (newUp !== activeDirs.up) {
        activeDirs.up = newUp;
        applyDirection("up", newUp);
      }
      if (newDown !== activeDirs.down) {
        activeDirs.down = newDown;
        applyDirection("down", newDown);
      }
    }

    function resetJoystick() {
      activePointerId = null;
      knob.style.transform = "translate3d(0, 0, 0)";
      if (activeDirs.left) {
        activeDirs.left = false;
        applyDirection("left", false);
      }
      if (activeDirs.right) {
        activeDirs.right = false;
        applyDirection("right", false);
      }
      if (activeDirs.up) {
        activeDirs.up = false;
        applyDirection("up", false);
      }
      if (activeDirs.down) {
        activeDirs.down = false;
        applyDirection("down", false);
      }
    }

    base.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      activePointerId = e.pointerId;
      try {
        base.setPointerCapture(e.pointerId);
      } catch (_) {}
      updateJoystick(e.clientX, e.clientY);
    });

    base.addEventListener("pointermove", function (e) {
      if (activePointerId !== null && e.pointerId === activePointerId) {
        e.preventDefault();
        updateJoystick(e.clientX, e.clientY);
      }
    });

    base.addEventListener("pointerup", function (e) {
      if (activePointerId !== null && e.pointerId === activePointerId) {
        e.preventDefault();
        try {
          base.releasePointerCapture(e.pointerId);
        } catch (_) {}
        resetJoystick();
      }
    });

    base.addEventListener("pointercancel", function () {
      resetJoystick();
    });
  }

  /* -------------------------------------------------------------
   * Touch Buttons and Auto-Fire
   * ------------------------------------------------------------- */
  function toggleAutoFire() {
    autoFireActive = !autoFireActive;
    var btn = document.getElementById("touch-autofire-btn");
    var label = document.getElementById("touch-autofire-label");
    if (btn) {
      btn.setAttribute("data-autofire", autoFireActive ? "true" : "false");
      if (autoFireActive) btn.classList.add("active");
      else btn.classList.remove("active");
    }
    if (label) {
      label.textContent = autoFireActive ? "AUTO-FUEGO: ON" : "AUTO-FUEGO: OFF";
    }

    if (autoFireInterval) {
      clearInterval(autoFireInterval);
      autoFireInterval = null;
    }

    if (autoFireActive && currentEngine === "aerofighters" && snesInstance) {
      autoFireInterval = setInterval(function () {
        if (!snesInstance) return;
        try {
          snesInstance.pressDown("b");
          setTimeout(function () {
            if (snesInstance) {
              try {
                snesInstance.pressUp("b");
              } catch (_) {}
            }
          }, 35);
        } catch (_) {}
      }, 85);
    } else if (!autoFireActive && snesInstance) {
      try {
        snesInstance.pressUp("b");
      } catch (_) {}
    }
  }

  function setupTouchButtons() {
    var touchControls = document.getElementById("wipeout-touch-controls");
    if (!touchControls) return;

    var autoBtn = document.getElementById("touch-autofire-btn");
    if (autoBtn) {
      autoBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (currentEngine === "aerofighters") {
          toggleAutoFire();
        }
      });
    }

    var buttons = touchControls.querySelectorAll("[data-button]");
    buttons.forEach(function (btn) {
      var code = parseInt(btn.getAttribute("data-button"), 10);

      function pressAction(pressed) {
        if (pressed) btn.classList.add("active");
        else btn.classList.remove("active");

        if (currentEngine === "aerofighters" && snesInstance) {
          if (code === 27) {
            // Shoot (Button B)
            if (pressed) snesInstance.pressDown("b");
            else snesInstance.pressUp("b");
          } else if (code === 29) {
            // Special Bomb (Button A)
            if (pressed) snesInstance.pressDown("a");
            else snesInstance.pressUp("a");
          } else if (code === 40) {
            // Start / Pause
            if (pressed) snesInstance.pressDown("start");
            else snesInstance.pressUp("start");
          } else if (code === 4) {
            // Select
            if (pressed) snesInstance.pressDown("select");
            else snesInstance.pressUp("select");
          }
        } else if (currentEngine === "wipeout") {
          setGameButton(code, pressed);
        }
      }

      btn.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        pressAction(true);
      });

      btn.addEventListener("pointerup", function (e) {
        e.preventDefault();
        try {
          btn.releasePointerCapture(e.pointerId);
        } catch (_) {}
        pressAction(false);
      });

      btn.addEventListener("pointercancel", function () {
        pressAction(false);
      });
    });
  }

  function setGameButton(code, pressed) {
    if (window.Module && typeof window.Module._set_button === "function") {
      try {
        window.Module._set_button(code, pressed ? 1 : 0);
      } catch (_) {}
    }
  }

  /* -------------------------------------------------------------
   * Keyboard Controls for Aero Fighters
   * ------------------------------------------------------------- */
  function setupAeroFightersKeyboard() {
    document.addEventListener("keydown", function (e) {
      var modal = document.getElementById("wipeout-modal");
      if (!modal || !modal.open || currentEngine !== "aerofighters" || !snesInstance) return;

      var k = e.key;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].indexOf(k) !== -1) {
        e.preventDefault();
      }

      if (e.repeat) return;

      if (k === "ArrowUp" || k === "w" || k === "W") snesInstance.pressDown("up");
      else if (k === "ArrowDown" || k === "s" || k === "S") snesInstance.pressDown("down");
      else if (k === "ArrowLeft" || k === "a" || k === "A") snesInstance.pressDown("left");
      else if (k === "ArrowRight" || k === "d" || k === "D") snesInstance.pressDown("right");
      else if (k === "z" || k === "Z" || k === "j" || k === "J") snesInstance.pressDown("b");
      else if (k === "x" || k === "X" || k === "k" || k === "K") snesInstance.pressDown("a");
      else if (k === "Enter") snesInstance.pressDown("start");
      else if (k === "Shift") snesInstance.pressDown("select");
      else if (k === "c" || k === "C") toggleAutoFire();
    });

    document.addEventListener("keyup", function (e) {
      var modal = document.getElementById("wipeout-modal");
      if (!modal || !modal.open || currentEngine !== "aerofighters" || !snesInstance) return;

      var k = e.key;
      if (k === "ArrowUp" || k === "w" || k === "W") snesInstance.pressUp("up");
      else if (k === "ArrowDown" || k === "s" || k === "S") snesInstance.pressUp("down");
      else if (k === "ArrowLeft" || k === "a" || k === "A") snesInstance.pressUp("left");
      else if (k === "ArrowRight" || k === "d" || k === "D") snesInstance.pressUp("right");
      else if (k === "z" || k === "Z" || k === "j" || k === "J") snesInstance.pressUp("b");
      else if (k === "x" || k === "X" || k === "k" || k === "K") snesInstance.pressUp("a");
      else if (k === "Enter") snesInstance.pressUp("start");
      else if (k === "Shift") snesInstance.pressUp("select");
    });
  }

  /* -------------------------------------------------------------
   * Modal and Utility Controls
   * ------------------------------------------------------------- */
  function setupModalEvents() {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;

    var switchBtn = modal.querySelector("[data-easter-egg-switch]");
    if (switchBtn) {
      switchBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (currentEngine === "aerofighters") {
          if (snesInstance) {
            try {
              snesInstance.pause();
            } catch (_) {}
          }
          launchWipEout();
        } else {
          launchAeroFighters();
        }
      });
    }

    var closeBtn = modal.querySelector("[data-wipeout-close]");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeEasterEgg();
      });
    }

    var errCloseBtn = modal.querySelector("[data-wipeout-error-close]");
    if (errCloseBtn) {
      errCloseBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeEasterEgg();
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
        restartGame();
      });
    }

    var retryBtn = modal.querySelector("[data-wipeout-retry]");
    if (retryBtn) {
      retryBtn.addEventListener("click", function (e) {
        e.preventDefault();
        restartGame();
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
      closeEasterEgg();
    });

    modal.addEventListener("close", function () {
      closeEasterEgg();
    });

    document.addEventListener("keydown", function (e) {
      if (modal.open && e.key === "Escape") {
        if (helpOverlay && !helpOverlay.hidden) {
          helpOverlay.hidden = true;
          focusCanvas();
          return;
        }
        closeEasterEgg();
      }
    });
  }

  function toggleAudioMute() {
    isAudioMuted = !isAudioMuted;

    activeAudioContexts.forEach(function (ctx) {
      try {
        if (isAudioMuted) ctx.suspend();
        else ctx.resume();
      } catch (_) {}
    });

    if (window.Module && window.Module._saudio_context) {
      try {
        if (isAudioMuted) window.Module._saudio_context.suspend();
        else window.Module._saudio_context.resume();
      } catch (_) {}
    }

    updateAudioButtonUI(isAudioMuted);
  }

  function updateAudioButtonUI(muted) {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;
    var audioBtn = modal.querySelector("[data-wipeout-audio]");
    var onIcon = modal.querySelector(".audio-on-icon");
    var offIcon = modal.querySelector(".audio-off-icon");
    var label = modal.querySelector(".audio-label");

    if (muted) {
      if (onIcon) onIcon.style.display = "none";
      if (offIcon) offIcon.style.display = "block";
      if (label) label.textContent = "Silenciado";
      if (audioBtn) audioBtn.setAttribute("aria-label", "Activar sonido");
    } else {
      if (onIcon) onIcon.style.display = "block";
      if (offIcon) offIcon.style.display = "none";
      if (label) label.textContent = "Audio";
      if (audioBtn) audioBtn.setAttribute("aria-label", "Silenciar sonido");
    }
  }

  function restartGame() {
    var overlay = document.getElementById("wipeout-error-overlay");
    if (overlay) overlay.hidden = true;

    if (currentEngine === "aerofighters" && snesInstance) {
      try {
        snesInstance.restart();
        focusCanvas();
      } catch (_) {
        window.location.search = "?game=aerofighters";
      }
    } else if (currentEngine === "wipeout") {
      window.location.search = "?wipeout=1";
    }
  }

  function toggleFullscreen() {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;
    if (!document.fullscreenElement) {
      modal.requestFullscreen().catch(function () {});
    } else {
      document.exitFullscreen().catch(function () {});
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

  function closeEasterEgg() {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;

    if (autoFireInterval) {
      clearInterval(autoFireInterval);
      autoFireInterval = null;
    }

    if (snesInstance) {
      try {
        snesInstance.pause();
      } catch (_) {}
    }

    if (window.Module && window.Module._saudio_context) {
      try {
        window.Module._saudio_context.suspend();
      } catch (_) {}
    }

    if (gamepadLoopId) {
      cancelAnimationFrame(gamepadLoopId);
      gamepadLoopId = null;
    }

    if (modal.open) {
      modal.close();
    }

    if (previousActiveElement && typeof previousActiveElement.focus === "function") {
      previousActiveElement.focus();
    }
  }

  /* -------------------------------------------------------------
   * Gamepad Support
   * ------------------------------------------------------------- */
  function startGamepadPolling() {
    if (gamepadLoopId) return;

    function poll() {
      var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      var gp = gamepads[0];
      if (gp) {
        var aPressed = gp.buttons[0] && gp.buttons[0].pressed;
        var bPressed = gp.buttons[1] && gp.buttons[1].pressed;
        var startPressed = gp.buttons[9] && gp.buttons[9].pressed;
        var selectPressed = gp.buttons[8] && gp.buttons[8].pressed;

        var dpadUp = (gp.buttons[12] && gp.buttons[12].pressed) || gp.axes[1] < -0.4;
        var dpadDown = (gp.buttons[13] && gp.buttons[13].pressed) || gp.axes[1] > 0.4;
        var dpadLeft = (gp.buttons[14] && gp.buttons[14].pressed) || gp.axes[0] < -0.4;
        var dpadRight = (gp.buttons[15] && gp.buttons[15].pressed) || gp.axes[0] > 0.4;

        if (currentEngine === "aerofighters" && snesInstance) {
          if (aPressed !== activeGamepadState.a) {
            activeGamepadState.a = aPressed;
            if (aPressed) snesInstance.pressDown("b");
            else snesInstance.pressUp("b");
          }
          if (bPressed !== activeGamepadState.b) {
            activeGamepadState.b = bPressed;
            if (bPressed) snesInstance.pressDown("a");
            else snesInstance.pressUp("a");
          }
          if (startPressed !== activeGamepadState.start) {
            activeGamepadState.start = startPressed;
            if (startPressed) snesInstance.pressDown("start");
            else snesInstance.pressUp("start");
          }
          if (dpadUp !== activeGamepadState.up) {
            activeGamepadState.up = dpadUp;
            if (dpadUp) snesInstance.pressDown("up");
            else snesInstance.pressUp("up");
          }
          if (dpadDown !== activeGamepadState.down) {
            activeGamepadState.down = dpadDown;
            if (dpadDown) snesInstance.pressDown("down");
            else snesInstance.pressUp("down");
          }
          if (dpadLeft !== activeGamepadState.left) {
            activeGamepadState.left = dpadLeft;
            if (dpadLeft) snesInstance.pressDown("left");
            else snesInstance.pressUp("left");
          }
          if (dpadRight !== activeGamepadState.right) {
            activeGamepadState.right = dpadRight;
            if (dpadRight) snesInstance.pressDown("right");
            else snesInstance.pressUp("right");
          }
        }
      }
      gamepadLoopId = requestAnimationFrame(poll);
    }
    gamepadLoopId = requestAnimationFrame(poll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEasterEgg);
  } else {
    initEasterEgg();
  }
})();
