/**
 * Retro Arcade Easter Egg Controller - Aero Fighters (SNES - 1993)
 * WebAssembly Snes9x + SPC700 synthesized audio + Virtual Analog Joystick
 * Supports 1-Player and 2-Player Co-op (Keyboard, Dual Gamepads, Touchscreen)
 *
 * Zero performance impact on portfolio initial page load (lazy-loaded).
 */
(function () {
  "use strict";

  var KONAMI_SEQUENCE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

  var snesInstance = null;
  var isAudioMuted = false;
  var autoFireP1Active = false;
  var autoFireP1Interval = null;
  var autoFireP2Active = false;
  var autoFireP2Interval = null;
  var activeGamepadStateP1 = {};
  var activeGamepadStateP2 = {};
  var gamepadLoopId = null;
  var previousActiveElement = null;
  var trackToastTimer = null;
  var activeAudioContexts = [];
  var activeHolds = {};

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

  var activeDirsP1 = { up: false, down: false, left: false, right: false };

  function checkUrlTrigger() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.has("game") || params.has("aerofighters") || params.has("antigravity") || params.has("wipeout")) {
        var cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
        setTimeout(launchAeroFighters, 300);
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
      return "AG-SYSTEMS: Aero Fighters (SNES) started.";
    };
    window.aerofighters = function () {
      launchAeroFighters();
      return "AG-SYSTEMS: Aero Fighters (SNES) started.";
    };
    window.wipeout = function () {
      launchAeroFighters();
      return "AG-SYSTEMS: Aero Fighters (SNES) started.";
    };
    window.joinPlayer2 = function () {
      joinPlayer2();
      return "AG-SYSTEMS: Player 2 Join requested.";
    };

    console.log(
      "%c[AG-SYSTEMS]%c Aero Fighters (SNES) Easter Egg ready.\nRun %cwindow.aerofighters()%c to play (or %cwindow.joinPlayer2()%c for Player 2 co-op).",
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

    avatar.addEventListener("click", function () {
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

  /* -------------------------------------------------------------
   * Aero Fighters Engine (WebAssembly Snes9x + SPC700 Sound)
   * ------------------------------------------------------------- */
  async function launchAeroFighters() {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;

    if (!modal.open) {
      previousActiveElement = document.activeElement;
      modal.showModal();
      flashBanner("AG-SYSTEMS // AERO FIGHTERS (SNES) ACTIVATED");
    }

    if (snesInstance) {
      showLoader(false);
      try {
        snesInstance.resume();
      } catch (_) {}
      focusCanvas();
      startGamepadPolling();
      return;
    }

    showLoader(true, "Starting emulator and SNES audio...", 25);

    try {
      if (typeof window.Nostalgist === "undefined") {
        updateLoaderProgress(50, "Loading WebAssembly core...");
        await loadScript("/assets/games/snes/nostalgist.umd.js");
      }

      updateLoaderProgress(75, "Initializing SPC700 sound processor...");

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
          // Player 1 controls
          input_player1_up: "w",
          input_player1_down: "s",
          input_player1_left: "a",
          input_player1_right: "d",
          input_player1_y: "v", // Player 1 Button B (Fire)
          input_player1_b: "b", // Player 1 Button A (Special Bomb)
          input_player1_start: "enter",
          input_player1_select: "shift",
          // Player 2 controls
          input_player2_up: "up",
          input_player2_down: "down",
          input_player2_left: "left",
          input_player2_right: "right",
          input_player2_y: "j", // Player 2 Button B (Fire)
          input_player2_b: "k", // Player 2 Button A (Special Bomb)
          input_player2_start: "i", // Player 2 Start / Join
          input_player2_select: "o", // Player 2 Select
        },
      });
      window.snesInstance = snesInstance;

      showLoader(false);
      focusCanvas();
      startGamepadPolling();

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
      showError("Error launching Aero Fighters", err && err.message ? err.message : String(err));
    }
  }

  /* -------------------------------------------------------------
   * Input Registration with Enforced Minimum Hold Duration
   * Supports Player 1 and Player 2 Co-op.
   * Ensures rapid taps on touchscreen or keyboard are cleanly sampled
   * by SNES 60Hz Joypad polling even during simultaneous movement.
   * ------------------------------------------------------------- */
  function sendPress(btnName, pressed, player) {
    if (!snesInstance) return;
    player = player || 1;
    var holdKey = player + "_" + btnName;

    if (pressed) {
      if (activeHolds[holdKey] && activeHolds[holdKey].timer) {
        clearTimeout(activeHolds[holdKey].timer);
        activeHolds[holdKey].timer = null;
      }
      activeHolds[holdKey] = {
        startTime: Date.now(),
      };
      try {
        if (player === 1) {
          snesInstance.pressDown(btnName);
        } else {
          snesInstance.pressDown({ button: btnName, player: 2 });
        }
      } catch (_) {}
    } else {
      var hold = activeHolds[holdKey];
      if (hold) {
        var elapsed = Date.now() - hold.startTime;
        var minHold = 110; // at least 6-7 frames of 60fps joypad polling
        if (elapsed < minHold) {
          hold.timer = setTimeout(function () {
            try {
              if (snesInstance) {
                if (player === 1) {
                  snesInstance.pressUp(btnName);
                } else {
                  snesInstance.pressUp({ button: btnName, player: 2 });
                }
              }
            } catch (_) {}
            delete activeHolds[holdKey];
          }, minHold - elapsed);
        } else {
          try {
            if (player === 1) {
              snesInstance.pressUp(btnName);
            } else {
              snesInstance.pressUp({ button: btnName, player: 2 });
            }
          } catch (_) {}
          delete activeHolds[holdKey];
        }
      } else {
        try {
          if (player === 1) {
            snesInstance.pressUp(btnName);
          } else {
            snesInstance.pressUp({ button: btnName, player: 2 });
          }
        } catch (_) {}
      }
    }
  }

  function joinPlayer2() {
    if (!snesInstance) return;
    sendPress("start", true, 2);
    setTimeout(function () {
      sendPress("start", false, 2);
    }, 120);

    // Follow-up fire press to confirm selection if at select screen
    setTimeout(function () {
      sendPress("y", true, 2);
      setTimeout(function () {
        sendPress("y", false, 2);
      }, 120);
    }, 450);

    showToast("PLAYER 2 JOINED", "CO-OP MODE ACTIVE");
  }

  /* -------------------------------------------------------------
   * Virtual Analog Joystick Module (Player 1)
   * ------------------------------------------------------------- */
  function setupVirtualJoystick() {
    var zone = document.getElementById("touch-joystick-zone");
    var base = document.getElementById("touch-joystick-base");
    var knob = document.getElementById("touch-joystick-knob");
    if (!base || !knob) return;

    var tickU = base.querySelector(".tick-u");
    var tickD = base.querySelector(".tick-d");
    var tickL = base.querySelector(".tick-l");
    var tickR = base.querySelector(".tick-r");

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
      if (snesInstance) {
        if (pressed) {
          try {
            snesInstance.pressDown(dir);
          } catch (_) {}
        } else {
          try {
            snesInstance.pressUp(dir);
          } catch (_) {}
        }
      }
    }

    function updateTicks(u, d, l, r) {
      if (tickU) tickU.classList.toggle("active", !!u);
      if (tickD) tickD.classList.toggle("active", !!d);
      if (tickL) tickL.classList.toggle("active", !!l);
      if (tickR) tickR.classList.toggle("active", !!r);
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

      knob.style.transition = "none";
      knob.style.transform = "translate3d(" + knobX + "px, " + knobY + "px, 0)";

      var deadzone = 9;
      var newUp = false;
      var newDown = false;
      var newLeft = false;
      var newRight = false;

      if (dist >= deadzone) {
        var deg = (angle * 180) / Math.PI;
        if (deg < 0) deg += 360;

        // 8-way directional sectors (45 deg each)
        if (deg >= 337.5 || deg < 22.5) {
          newRight = true;
        } else if (deg >= 22.5 && deg < 67.5) {
          newDown = true;
          newRight = true;
        } else if (deg >= 67.5 && deg < 112.5) {
          newDown = true;
        } else if (deg >= 112.5 && deg < 157.5) {
          newDown = true;
          newLeft = true;
        } else if (deg >= 157.5 && deg < 202.5) {
          newLeft = true;
        } else if (deg >= 202.5 && deg < 247.5) {
          newUp = true;
          newLeft = true;
        } else if (deg >= 247.5 && deg < 292.5) {
          newUp = true;
        } else if (deg >= 292.5 && deg < 337.5) {
          newUp = true;
          newRight = true;
        }
      }

      updateTicks(newUp, newDown, newLeft, newRight);

      if (newLeft !== activeDirsP1.left) {
        activeDirsP1.left = newLeft;
        applyDirection("left", newLeft);
      }
      if (newRight !== activeDirsP1.right) {
        activeDirsP1.right = newRight;
        applyDirection("right", newRight);
      }
      if (newUp !== activeDirsP1.up) {
        activeDirsP1.up = newUp;
        applyDirection("up", newUp);
      }
      if (newDown !== activeDirsP1.down) {
        activeDirsP1.down = newDown;
        applyDirection("down", newDown);
      }
    }

    function resetJoystick() {
      activePointerId = null;
      knob.style.transition = "transform 140ms cubic-bezier(0.175, 0.885, 0.32, 1.275)";
      knob.style.transform = "translate3d(0, 0, 0)";
      updateTicks(false, false, false, false);

      if (activeDirsP1.left) {
        activeDirsP1.left = false;
        applyDirection("left", false);
      }
      if (activeDirsP1.right) {
        activeDirsP1.right = false;
        applyDirection("right", false);
      }
      if (activeDirsP1.up) {
        activeDirsP1.up = false;
        applyDirection("up", false);
      }
      if (activeDirsP1.down) {
        activeDirsP1.down = false;
        applyDirection("down", false);
      }
    }

    var touchTarget = zone || base;
    touchTarget.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      activePointerId = e.pointerId;
      try {
        touchTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
      updateJoystick(e.clientX, e.clientY);
    });

    touchTarget.addEventListener("pointermove", function (e) {
      if (activePointerId !== null && e.pointerId === activePointerId) {
        e.preventDefault();
        updateJoystick(e.clientX, e.clientY);
      }
    });

    touchTarget.addEventListener("pointerup", function (e) {
      if (activePointerId !== null && e.pointerId === activePointerId) {
        e.preventDefault();
        try {
          touchTarget.releasePointerCapture(e.pointerId);
        } catch (_) {}
        resetJoystick();
      }
    });

    touchTarget.addEventListener("pointercancel", function () {
      resetJoystick();
    });
  }

  /* -------------------------------------------------------------
   * Touch Buttons and Auto-Fire
   * ------------------------------------------------------------- */
  function toggleAutoFire(player) {
    player = player || 1;
    if (player === 1) {
      autoFireP1Active = !autoFireP1Active;
      var btn = document.getElementById("touch-autofire-btn");
      var label = document.getElementById("touch-autofire-label");
      if (btn) {
        btn.setAttribute("data-autofire", autoFireP1Active ? "true" : "false");
        btn.classList.toggle("active", autoFireP1Active);
      }
      if (label) {
        label.textContent = autoFireP1Active ? "AUTO: ON" : "AUTO: OFF";
      }

      if (autoFireP1Interval) {
        clearInterval(autoFireP1Interval);
        autoFireP1Interval = null;
      }

      if (autoFireP1Active && snesInstance) {
        showToast("PLAYER 1 AUTO-FIRE: ON", "RAPID FIRE MODE");
        autoFireP1Interval = setInterval(function () {
          if (!snesInstance) return;
          try {
            snesInstance.pressDown("y");
            setTimeout(function () {
              if (snesInstance) {
                try {
                  snesInstance.pressUp("y");
                } catch (_) {}
              }
            }, 40);
          } catch (_) {}
        }, 90);
      } else if (!autoFireP1Active && snesInstance) {
        showToast("PLAYER 1 AUTO-FIRE: OFF", "RAPID FIRE MODE");
        try {
          snesInstance.pressUp("y");
        } catch (_) {}
      }
    } else {
      autoFireP2Active = !autoFireP2Active;
      if (autoFireP2Interval) {
        clearInterval(autoFireP2Interval);
        autoFireP2Interval = null;
      }
      if (autoFireP2Active && snesInstance) {
        showToast("PLAYER 2 AUTO-FIRE: ON", "RAPID FIRE MODE");
        autoFireP2Interval = setInterval(function () {
          if (!snesInstance) return;
          try {
            snesInstance.pressDown({ button: "y", player: 2 });
            setTimeout(function () {
              if (snesInstance) {
                try {
                  snesInstance.pressUp({ button: "y", player: 2 });
                } catch (_) {}
              }
            }, 40);
          } catch (_) {}
        }, 90);
      } else if (!autoFireP2Active && snesInstance) {
        showToast("PLAYER 2 AUTO-FIRE: OFF", "RAPID FIRE MODE");
        try {
          snesInstance.pressUp({ button: "y", player: 2 });
        } catch (_) {}
      }
    }
  }

  function setupTouchButtons() {
    var touchControls = document.getElementById("wipeout-touch-controls");
    if (!touchControls) return;

    var autoBtn = document.getElementById("touch-autofire-btn");
    if (autoBtn) {
      autoBtn.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        toggleAutoFire(1);
      });
    }

    var buttons = touchControls.querySelectorAll(".touch-btn:not(#touch-autofire-btn)");
    buttons.forEach(function (btn) {
      var code = parseInt(btn.getAttribute("data-button"), 10);
      var action = btn.getAttribute("data-action");

      // Resolve button mapping for Aero Fighters
      var snesKey = null;
      var targetPlayer = 1;

      if (action === "shoot" || code === 27) {
        snesKey = "y"; // Fire / Shoot (Button B)
      } else if (action === "bomb" || code === 29) {
        snesKey = "b"; // Special Bomb (Button A)
      } else if (action === "start" || code === 40) {
        snesKey = "start";
      } else if (action === "select" || code === 4) {
        snesKey = "select";
      } else if (action === "p2-join") {
        snesKey = "p2-join";
      }

      function handlePress(pressed) {
        if (pressed) btn.classList.add("active");
        else btn.classList.remove("active");

        if (snesKey === "p2-join") {
          if (pressed) {
            joinPlayer2();
          }
        } else if (snesKey) {
          sendPress(snesKey, pressed, targetPlayer);
        }
      }

      btn.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        handlePress(true);
      });

      btn.addEventListener("pointerup", function (e) {
        e.preventDefault();
        handlePress(false);
      });

      btn.addEventListener("pointerleave", function (e) {
        e.preventDefault();
        handlePress(false);
      });

      btn.addEventListener("pointercancel", function () {
        handlePress(false);
      });
    });
  }

  /* -------------------------------------------------------------
   * Keyboard Controls for Aero Fighters (Player 1 & Player 2 Co-op)
   * ------------------------------------------------------------- */
  function setupAeroFightersKeyboard() {
    document.addEventListener("keydown", function (e) {
      var modal = document.getElementById("wipeout-modal");
      if (!modal || !modal.open || !snesInstance) return;

      var k = e.key;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter", "Tab"].indexOf(k) !== -1) {
        e.preventDefault();
      }

      if (e.repeat) return;

      // --- PLAYER 1 CONTROLS ---
      if (k === "w" || k === "W") sendPress("up", true, 1);
      else if (k === "s" || k === "S") sendPress("down", true, 1);
      else if (k === "a" || k === "A") sendPress("left", true, 1);
      else if (k === "d" || k === "D") sendPress("right", true, 1);
      // Player 1 Button B (Fire - SNES Y): 'V'
      else if (k === "v" || k === "V" || k === "z" || k === "Z" || k === " ") {
        sendPress("y", true, 1);
      }
      // Player 1 Button A (Special Bomb - SNES B): 'B'
      else if (k === "b" || k === "B" || k === "x" || k === "X") {
        sendPress("b", true, 1);
      }
      // Player 1 Auto-Fire Toggle: 'C'
      else if (k === "c" || k === "C") {
        toggleAutoFire(1);
      }
      // Player 1 Start: '1' or 'Enter'
      else if (k === "1" || k === "Enter") {
        sendPress("start", true, 1);
      }
      // Player 1 Select: 'Tab' or 'Shift'
      else if (k === "Tab" || k === "Shift") {
        sendPress("select", true, 1);
      }

      // --- PLAYER 2 CONTROLS (CO-OP) ---
      else if (k === "ArrowUp" || k === "8") {
        sendPress("up", true, 2);
      } else if (k === "ArrowDown" || k === "5") {
        sendPress("down", true, 2);
      } else if (k === "ArrowLeft" || k === "4") {
        sendPress("left", true, 2);
      } else if (k === "ArrowRight" || k === "6") {
        sendPress("right", true, 2);
      }
      // Player 2 Button B (Fire - SNES Y): 'J' (with ',' as alias)
      else if (k === "j" || k === "J" || k === "," || e.code === "Comma") {
        sendPress("y", true, 2);
      }
      // Player 2 Button A (Special Bomb - SNES B): 'K' (with '.' as alias)
      else if (k === "k" || k === "K" || k === "." || e.code === "Period") {
        sendPress("b", true, 2);
      }
      // Player 2 Auto-Fire Toggle: 'U' (with 'M' as alias)
      else if (k === "u" || k === "U" || k === "m" || k === "M") {
        toggleAutoFire(2);
      }
      // Player 2 Start / Join: 'I' (with '2', ''', '\', 'NumpadEnter' as aliases)
      else if (k === "i" || k === "I" || k === "2" || k === "'" || k === "\\" || k === "NumpadEnter") {
        sendPress("start", true, 2);
      }
      // Player 2 Select: 'O' (with '0', ';' as aliases)
      else if (k === "o" || k === "O" || k === "0" || k === ";") {
        sendPress("select", true, 2);
      }
    });

    document.addEventListener("keyup", function (e) {
      var modal = document.getElementById("wipeout-modal");
      if (!modal || !modal.open || !snesInstance) return;

      var k = e.key;

      // --- PLAYER 1 KEY RELEASES ---
      if (k === "w" || k === "W") sendPress("up", false, 1);
      else if (k === "s" || k === "S") sendPress("down", false, 1);
      else if (k === "a" || k === "A") sendPress("left", false, 1);
      else if (k === "d" || k === "D") sendPress("right", false, 1);
      else if (k === "v" || k === "V" || k === "z" || k === "Z" || k === " ") {
        sendPress("y", false, 1);
      } else if (k === "b" || k === "B" || k === "x" || k === "X") {
        sendPress("b", false, 1);
      } else if (k === "1" || k === "Enter") {
        sendPress("start", false, 1);
      } else if (k === "Tab" || k === "Shift") {
        sendPress("select", false, 1);
      }

      // --- PLAYER 2 KEY RELEASES ---
      else if (k === "ArrowUp" || k === "8") {
        sendPress("up", false, 2);
      } else if (k === "ArrowDown" || k === "5") {
        sendPress("down", false, 2);
      } else if (k === "ArrowLeft" || k === "4") {
        sendPress("left", false, 2);
      } else if (k === "ArrowRight" || k === "6") {
        sendPress("right", false, 2);
      } else if (k === "j" || k === "J" || k === "," || e.code === "Comma") {
        sendPress("y", false, 2);
      } else if (k === "k" || k === "K" || k === "." || e.code === "Period") {
        sendPress("b", false, 2);
      } else if (k === "i" || k === "I" || k === "2" || k === "'" || k === "\\" || k === "NumpadEnter") {
        sendPress("start", false, 2);
      } else if (k === "o" || k === "O" || k === "0" || k === ";") {
        sendPress("select", false, 2);
      }
    });
  }

  /* -------------------------------------------------------------
   * Modal and Utility Controls
   * ------------------------------------------------------------- */
  function setupModalEvents() {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;

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

    var p2Btn = modal.querySelector("[data-wipeout-p2]");
    if (p2Btn) {
      p2Btn.addEventListener("click", function (e) {
        e.preventDefault();
        joinPlayer2();
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

    document.addEventListener("fullscreenchange", function () {
      var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      var currentModal = document.getElementById("wipeout-modal");
      if (currentModal) {
        if (!isFs && !currentModal.classList.contains("is-fullscreen")) {
          updateFullscreenUI(false);
        } else if (isFs) {
          currentModal.classList.add("is-fullscreen");
          updateFullscreenUI(true);
        }
      }
    });

    document.addEventListener("webkitfullscreenchange", function () {
      var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      var currentModal = document.getElementById("wipeout-modal");
      if (currentModal) {
        if (!isFs && !currentModal.classList.contains("is-fullscreen")) {
          updateFullscreenUI(false);
        } else if (isFs) {
          currentModal.classList.add("is-fullscreen");
          updateFullscreenUI(true);
        }
      }
    });

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
      if (label) label.textContent = "Muted";
      if (audioBtn) audioBtn.setAttribute("aria-label", "Unmute audio");
    } else {
      if (onIcon) onIcon.style.display = "block";
      if (offIcon) offIcon.style.display = "none";
      if (label) label.textContent = "Audio";
      if (audioBtn) audioBtn.setAttribute("aria-label", "Mute audio");
    }
  }

  function restartGame() {
    var overlay = document.getElementById("wipeout-error-overlay");
    if (overlay) overlay.hidden = true;

    if (snesInstance) {
      try {
        snesInstance.restart();
        focusCanvas();
      } catch (_) {
        window.location.search = "?game=aerofighters";
      }
    } else {
      launchAeroFighters();
    }
  }

  function toggleFullscreen() {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;

    var isCurrentlyFs = modal.classList.contains("is-fullscreen") || !!(document.fullscreenElement || document.webkitFullscreenElement);

    if (!isCurrentlyFs) {
      modal.classList.add("is-fullscreen");
      document.body.classList.add("game-fullscreen-active");
      var docEl = document.documentElement;
      var req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;

      if (req) {
        try {
          var p = req.call(docEl);
          if (p && typeof p.catch === "function") p.catch(function () {});
        } catch (_) {}
      }
      updateFullscreenUI(true);
    } else {
      modal.classList.remove("is-fullscreen");
      document.body.classList.remove("game-fullscreen-active");
      var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;

      if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
        try {
          var pExit = exit.call(document);
          if (pExit && typeof pExit.catch === "function") pExit.catch(function () {});
        } catch (_) {}
      }
      updateFullscreenUI(false);
    }

    if (snesInstance && typeof snesInstance.resize === "function") {
      try {
        snesInstance.resize();
      } catch (_) {}
    }
    focusCanvas();
  }

  function updateFullscreenUI(isFullscreen) {
    var modal = document.getElementById("wipeout-modal");
    if (!modal) return;
    var fsBtn = modal.querySelector("[data-wipeout-fullscreen]");
    if (!fsBtn) return;
    var btnText = fsBtn.querySelector(".btn-text");

    if (isFullscreen) {
      fsBtn.setAttribute("title", "Exit Fullscreen");
      fsBtn.setAttribute("aria-label", "Exit Fullscreen");
      if (btnText) btnText.textContent = "Exit";
      fsBtn.classList.add("active");
    } else {
      fsBtn.setAttribute("title", "Fullscreen");
      fsBtn.setAttribute("aria-label", "Fullscreen");
      if (btnText) btnText.textContent = "Fullscreen";
      fsBtn.classList.remove("active");
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

    if (autoFireP1Interval) {
      clearInterval(autoFireP1Interval);
      autoFireP1Interval = null;
    }
    if (autoFireP2Interval) {
      clearInterval(autoFireP2Interval);
      autoFireP2Interval = null;
    }

    if (snesInstance) {
      try {
        snesInstance.pause();
      } catch (_) {}
    }

    if (gamepadLoopId) {
      cancelAnimationFrame(gamepadLoopId);
      gamepadLoopId = null;
    }

    if (modal.classList.contains("is-fullscreen")) {
      modal.classList.remove("is-fullscreen");
      document.body.classList.remove("game-fullscreen-active");
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
        try {
          exit.call(document);
        } catch (_) {}
      }
      updateFullscreenUI(false);
    }

    if (modal.open) {
      modal.close();
    }

    if (previousActiveElement && typeof previousActiveElement.focus === "function") {
      previousActiveElement.focus();
    }
  }

  /* -------------------------------------------------------------
   * Dual Gamepad Support (1P & 2P Co-op)
   * ------------------------------------------------------------- */
  function pollSingleGamepad(gp, player, state) {
    if (!gp || !snesInstance) return;

    var aPressed = (gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[2] && gp.buttons[2].pressed);
    var bPressed = (gp.buttons[1] && gp.buttons[1].pressed) || (gp.buttons[3] && gp.buttons[3].pressed);
    var startPressed = gp.buttons[9] && gp.buttons[9].pressed;
    var selectPressed = gp.buttons[8] && gp.buttons[8].pressed;

    var dpadUp = (gp.buttons[12] && gp.buttons[12].pressed) || gp.axes[1] < -0.4;
    var dpadDown = (gp.buttons[13] && gp.buttons[13].pressed) || gp.axes[1] > 0.4;
    var dpadLeft = (gp.buttons[14] && gp.buttons[14].pressed) || gp.axes[0] < -0.4;
    var dpadRight = (gp.buttons[15] && gp.buttons[15].pressed) || gp.axes[0] > 0.4;

    if (aPressed !== state.a) {
      state.a = aPressed;
      sendPress("y", aPressed, player);
    }
    if (bPressed !== state.b) {
      state.b = bPressed;
      sendPress("b", bPressed, player);
    }
    if (startPressed !== state.start) {
      state.start = startPressed;
      sendPress("start", startPressed, player);
    }
    if (selectPressed !== state.select) {
      state.select = selectPressed;
      sendPress("select", selectPressed, player);
    }

    if (dpadUp !== state.up) {
      state.up = dpadUp;
      sendPress("up", dpadUp, player);
    }
    if (dpadDown !== state.down) {
      state.down = dpadDown;
      sendPress("down", dpadDown, player);
    }
    if (dpadLeft !== state.left) {
      state.left = dpadLeft;
      sendPress("left", dpadLeft, player);
    }
    if (dpadRight !== state.right) {
      state.right = dpadRight;
      sendPress("right", dpadRight, player);
    }
  }

  function startGamepadPolling() {
    if (gamepadLoopId) return;

    function poll() {
      var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      if (gamepads[0]) {
        pollSingleGamepad(gamepads[0], 1, activeGamepadStateP1);
      }
      if (gamepads[1]) {
        pollSingleGamepad(gamepads[1], 2, activeGamepadStateP2);
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
