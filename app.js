// app.js — wc-sim engine
// Architecture (from archived spec, session 19826272):
//   Team xG = xGBase * possShift * tempoScaler * pressureDampener
//   possShift = (poss/50)^possExp  (possession-based teams >0.5, counter teams closer to 0)
//   tempoScaler = 0.75 + 0.5 * ((tempo-14)/20)   -> 0.75 at tempo 14, 1.25 at tempo 34
//   pressureDampener = 1 - pressure/100 * 0.25   -> at pressure=88 (ET), dampener = 0.78
//   Match result via bivariate-Poisson on 10x10 grid; independence approximation, rho=0
//   Comeback boost: +10% xG for trailing team if >=20 min remain
//   xG/SoT conversion for player props: 0.36
//   Live mode: only remaining minutes contribute new xG (linear time scaling)

(function () {
  const state = {
    matchup: null,
    poss: 55,
    tempo: 23,
    pressure: 65,
    live: {
      active: false,
      minute: 0,
      homeGoals: 0,
      awayGoals: 0,
      comebackBoost: true
    }
  };

  const $ = (id) => document.getElementById(id);
  const fmtPct = (p) => (p * 100).toFixed(1) + "%";
  const fmtOdds = (p) => {
    if (p <= 0 || p >= 1) return "—";
    const dec = 1 / p;
    if (dec >= 2) return "+" + Math.round((dec - 1) * 100);
    return "-" + Math.round(100 / (dec - 1));
  };

  // Poisson pmf
  function poisson(k, lambda) {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    let logP = -lambda + k * Math.log(lambda);
    for (let i = 2; i <= k; i++) logP -= Math.log(i);
    return Math.exp(logP);
  }

  function teamXG(base, possShare, possExp, tempo, pressure) {
    const possShift = Math.pow(possShare / 50, possExp);
    const tempoScaler = 0.75 + 0.5 * ((tempo - 14) / 20);
    const pressureDampener = 1 - (pressure / 100) * 0.25;
    return base * possShift * tempoScaler * pressureDampener;
  }

  // Score grid over remaining goals from current live state (or full match if live off)
  function computeScoreGrid(lambdaH, lambdaA) {
    const grid = [];
    for (let h = 0; h < 10; h++) {
      grid[h] = [];
      for (let a = 0; a < 10; a++) {
        grid[h][a] = poisson(h, lambdaH) * poisson(a, lambdaA);
      }
    }
    return grid;
  }

  // Given current score and remaining lambdas, produce FT market probabilities
  function marketsFromGrid(grid, currentH, currentA) {
    let pH = 0, pD = 0, pA = 0, pBTTS = 0, p15 = 0, p25 = 0, p35 = 0;
    for (let dh = 0; dh < 10; dh++) {
      for (let da = 0; da < 10; da++) {
        const p = grid[dh][da];
        const ftH = currentH + dh;
        const ftA = currentA + da;
        if (ftH > ftA) pH += p;
        else if (ftH < ftA) pA += p;
        else pD += p;
        if (ftH >= 1 && ftA >= 1) pBTTS += p;
        const total = ftH + ftA;
        if (total >= 2) p15 += p;
        if (total >= 3) p25 += p;
        if (total >= 4) p35 += p;
      }
    }
    return { pH, pD, pA, pBTTS, p15, p25, p35 };
  }

  // Player prop: probability of >=1 SoT-to-goal event across remaining minutes
  // xGperMin = sotBase/90 * 0.36 * possShare-adjusted
  function playerAnyTimeProb(sotBase, teamShare, minutesRemaining) {
    // simple: expected goals contribution = sotBase/90 * 0.36 * minutesRemaining * (teamShare/50)^0.5
    const shareAdj = Math.pow(teamShare / 50, 0.5);
    const lambda = (sotBase / 90) * 0.36 * minutesRemaining * shareAdj;
    return 1 - Math.exp(-lambda);
  }

  function currentMinute() {
    return state.live.active ? state.live.minute : 0;
  }

  function minutesRemaining() {
    const now = currentMinute();
    return Math.max(0, 90 - now);
  }

  // Live lambdas: only remaining minutes contribute, with comeback boost if trailing team has >=20 min
  function liveLambdas() {
    const m = state.matchup;
    const homeShare = state.poss;
    const awayShare = 100 - state.poss;

    let lambdaH_full = teamXG(m.home.xGBase, homeShare, m.home.possExp, state.tempo, state.pressure);
    let lambdaA_full = teamXG(m.away.xGBase, awayShare, m.away.possExp, state.tempo, state.pressure);

    const remaining = minutesRemaining();
    const frac = remaining / 90;
    let lambdaH = lambdaH_full * frac;
    let lambdaA = lambdaA_full * frac;

    // Comeback boost — trailing team gets +10% if >=20 min remain
    if (state.live.active && state.live.comebackBoost && remaining >= 20) {
      if (state.live.homeGoals < state.live.awayGoals) lambdaH *= 1.10;
      else if (state.live.awayGoals < state.live.homeGoals) lambdaA *= 1.10;
    }

    return { lambdaH, lambdaA, lambdaH_full, lambdaA_full };
  }

  // ============ RENDER ============
  function render() {
    if (!state.matchup) return;
    const m = state.matchup;
    const { lambdaH, lambdaA, lambdaH_full, lambdaA_full } = liveLambdas();

    $("xgHomeVal").textContent = (state.live.active ? lambdaH : lambdaH_full).toFixed(2);
    $("xgAwayVal").textContent = (state.live.active ? lambdaA : lambdaA_full).toFixed(2);
    $("xgHomeLbl").textContent = m.home.name;
    $("xgAwayLbl").textContent = m.away.name;

    const grid = computeScoreGrid(lambdaH, lambdaA);
    const mk = marketsFromGrid(grid, state.live.homeGoals, state.live.awayGoals);

    $("mkH").textContent = fmtPct(mk.pH);
    $("mkD").textContent = fmtPct(mk.pD);
    $("mkA").textContent = fmtPct(mk.pA);
    $("mkH_odds").textContent = fmtOdds(mk.pH);
    $("mkD_odds").textContent = fmtOdds(mk.pD);
    $("mkA_odds").textContent = fmtOdds(mk.pA);
    $("mkBTTS").textContent = fmtPct(mk.pBTTS);
    $("mkO15").textContent = fmtPct(mk.p15);
    $("mkO25").textContent = fmtPct(mk.p25);
    $("mkO35").textContent = fmtPct(mk.p35);
    $("mkH_lbl").textContent = m.home.code + " win";
    $("mkA_lbl").textContent = m.away.code + " win";

    // Player props
    const remaining = minutesRemaining();
    const rows = m.players.map((p) => {
      const teamShare = p.team === m.home.code ? state.poss : 100 - state.poss;
      const prob = playerAnyTimeProb(p.sotBase, teamShare, remaining || 90);
      return { p, prob };
    });
    const playersHtml = rows.map(({ p, prob }) => {
      return `<div class="player-row">
        <span class="pn">${p.name}</span>
        <span class="pt">${p.team} · ${p.role}</span>
        <span class="pp">${fmtPct(prob)}</span>
        <small class="po">${fmtOdds(prob)}</small>
      </div>`;
    }).join("");
    $("playersList").innerHTML = playersHtml;

    // Model reads
    const reads = buildReads(mk, m, state);
    $("playsList").innerHTML = reads.map(r =>
      `<div class="play play-${r.tag.toLowerCase()}"><span class="tag">${r.tag}</span> ${r.text}</div>`
    ).join("");

    // Live banner
    if (state.live.active) {
      $("liveBanner").style.display = "flex";
      $("liveBannerText").textContent =
        `LIVE · ${m.home.code} ${state.live.homeGoals} - ${state.live.awayGoals} ${m.away.code} · ${state.live.minute}'`;
    } else {
      $("liveBanner").style.display = "none";
    }

    // Goal scenario explorer
    renderScenarios(m, mk);
  }

  function buildReads(mk, m, s) {
    const reads = [];
    if (s.live.active) {
      const trailing = s.live.homeGoals < s.live.awayGoals ? m.home.code :
                       s.live.awayGoals < s.live.homeGoals ? m.away.code : null;
      const leading = trailing === m.home.code ? m.away.code :
                      trailing === m.away.code ? m.home.code : null;
      if (trailing && minutesRemaining() >= 20) {
        reads.push({ tag: "LIVE", text: `${trailing} trailing with ${minutesRemaining()}' remaining. Comeback boost is ${s.live.comebackBoost ? "ON" : "OFF"} — flip to see xG delta.` });
      }
      if (mk.p25 >= 0.5 && s.live.homeGoals + s.live.awayGoals <= 1) {
        reads.push({ tag: "BET", text: `Live Over 2.5 sits at ${fmtPct(mk.p25)}. Books cut O2.5 hard after first goal; if you can grab +130 or better, fade.` });
      }
      if (leading && mk[leading === m.home.code ? "pH" : "pA"] >= 0.55) {
        reads.push({ tag: "HEDGE", text: `${leading} win prob ${fmtPct(mk[leading === m.home.code ? "pH" : "pA"])}. Consider ${leading} TT Over 1.5 as leverage.` });
      }
    } else {
      // Pre-match reads
      const edgeHome = mk.pH - 0.42;
      if (Math.abs(edgeHome) > 0.08) {
        reads.push({ tag: edgeHome > 0 ? "BET" : "FADE", text: `Model ${edgeHome > 0 ? "over" : "under"}weights ${m.home.code} by ${(edgeHome * 100).toFixed(1)}pp vs. typical R32 favorite line.` });
      }
      reads.push({ tag: "BET", text: `O2.5 at ${fmtPct(mk.p25)} — compare vs. market. Threshold: fade if market implies <${(mk.p25 * 100 - 5).toFixed(0)}%.` });
      reads.push({ tag: "LIVE", text: `Watch for early goal → live O2.5 typically overcuts. See scenario explorer below for goal-at-minute deltas.` });
    }
    if (reads.length === 0) reads.push({ tag: "LIVE", text: "Model in neutral zone. No high-conviction reads on current inputs." });
    return reads;
  }

  function renderScenarios(m, baseMk) {
    // Two forks: home scores next, away scores next — at goalMinute (from slider)
    const goalMin = parseInt($("goalMinute").value, 10);
    $("goalMinuteVal").textContent = goalMin + "'";
    const remaining = Math.max(0, 90 - goalMin);

    // Use current live score as base
    const cH = state.live.homeGoals;
    const cA = state.live.awayGoals;

    // Fork A: home scores next at goalMin -> new score cH+1 to cA, remaining minutes from goalMin
    // Fork B: away scores next at goalMin -> new score cH to cA+1
    const forkLambda = (extraForHome) => {
      const { lambdaH_full, lambdaA_full } = liveLambdas();
      const frac = remaining / 90;
      let lH = lambdaH_full * frac;
      let lA = lambdaA_full * frac;
      // Apply comeback boost to trailing team post-goal
      const newH = cH + (extraForHome ? 1 : 0);
      const newA = cA + (extraForHome ? 0 : 1);
      if (state.live.comebackBoost && remaining >= 20) {
        if (newH < newA) lH *= 1.10;
        else if (newA < newH) lA *= 1.10;
      }
      const grid = computeScoreGrid(lH, lA);
      return marketsFromGrid(grid, newH, newA);
    };

    const forkA = forkLambda(true);
    const forkB = forkLambda(false);

    $("scA_team").textContent = `${m.home.name} scores next (${goalMin}')`;
    $("scB_team").textContent = `${m.away.name} scores next (${goalMin}')`;

    $("scA_pH").textContent = fmtPct(forkA.pH); $("scA_oH").textContent = "@" + fmtOdds(forkA.pH);
    $("scA_pD").textContent = fmtPct(forkA.pD); $("scA_oD").textContent = "@" + fmtOdds(forkA.pD);
    $("scA_pA").textContent = fmtPct(forkA.pA); $("scA_oA").textContent = "@" + fmtOdds(forkA.pA);
    $("scA_o15").textContent = fmtPct(forkA.p15); $("scA_oo15").textContent = "@" + fmtOdds(forkA.p15);
    $("scA_o25").textContent = fmtPct(forkA.p25); $("scA_oo25").textContent = "@" + fmtOdds(forkA.p25);
    $("scA_btts").textContent = fmtPct(forkA.pBTTS); $("scA_obtts").textContent = "@" + fmtOdds(forkA.pBTTS);

    $("scB_pH").textContent = fmtPct(forkB.pH); $("scB_oH").textContent = "@" + fmtOdds(forkB.pH);
    $("scB_pD").textContent = fmtPct(forkB.pD); $("scB_oD").textContent = "@" + fmtOdds(forkB.pD);
    $("scB_pA").textContent = fmtPct(forkB.pA); $("scB_oA").textContent = "@" + fmtOdds(forkB.pA);
    $("scB_o15").textContent = fmtPct(forkB.p15); $("scB_oo15").textContent = "@" + fmtOdds(forkB.p15);
    $("scB_o25").textContent = fmtPct(forkB.p25); $("scB_oo25").textContent = "@" + fmtOdds(forkB.p25);
    $("scB_btts").textContent = fmtPct(forkB.pBTTS); $("scB_obtts").textContent = "@" + fmtOdds(forkB.pBTTS);
  }

  // ============ LIVE PULL ============
  // ESPN scoreboard JSON has CORS: *  and covers all WC games.
  const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

  async function pullLive() {
    const btn = $("pullLive");
    const status = $("pullStatus");
    btn.disabled = true;
    status.style.display = "block";
    status.textContent = "Fetching live state from ESPN…";
    try {
      const today = new Date();
      const dateStr = today.toISOString().slice(0,10).replace(/-/g,"");
      const url = `${ESPN_URL}?dates=${dateStr}`;
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error("ESPN " + resp.status);
      const data = await resp.json();
      const m = state.matchup;
      const evt = (data.events || []).find(e => {
        const nm = (e.name || "") + " " + (e.shortName || "");
        return m.espnKeys.every(k => nm.includes(k));
      });
      if (!evt) {
        status.textContent = `No live event on ESPN for ${m.label} today. Falling back to manual score entry.`;
        return;
      }
      const comp = evt.competitions[0];
      const st = comp.status;
      const clock = st.displayClock || (st.clock ? Math.round(st.clock/60) + "'" : "");
      const stateType = st.type.state;   // "pre" | "in" | "post"
      const detail = st.type.detail;     // "HT", "FT", etc.

      let homeScore = 0, awayScore = 0;
      for (const c of comp.competitors) {
        const isHome = c.homeAway === "home";
        // ESPN's home/away is by scheduling; our matchup home may differ.
        // We match by team name.
        const teamName = c.team.displayName || c.team.name;
        if (teamName.includes(m.home.name) || m.home.name.includes(teamName)) {
          homeScore = parseInt(c.score, 10) || 0;
        } else if (teamName.includes(m.away.name) || m.away.name.includes(teamName)) {
          awayScore = parseInt(c.score, 10) || 0;
        }
      }

      // Minute: prefer numeric clock if game in progress, cap at 89 for slider
      let minute = 0;
      if (stateType === "in") {
        if (detail && detail.toUpperCase().includes("HT")) minute = 45;
        else if (clock && /\d+/.test(clock)) minute = parseInt(clock.match(/\d+/)[0], 10);
        else if (st.clock) minute = Math.round(st.clock / 60);
      } else if (stateType === "post") {
        minute = 90;
      }

      $("liveHomeGoals").value = homeScore;
      $("liveAwayGoals").value = awayScore;
      $("goalMinute").value = Math.min(89, Math.max(1, minute || 60));
      $("liveToggle").checked = stateType === "in" || stateType === "post";
      state.live.active = $("liveToggle").checked;
      state.live.homeGoals = homeScore;
      state.live.awayGoals = awayScore;
      state.live.minute = minute;

      status.textContent = `ESPN ${stateType.toUpperCase()} · ${m.home.code} ${homeScore} - ${awayScore} ${m.away.code} · ${clock || detail || minute+"'"} · pulled ${new Date().toLocaleTimeString()}`;
      render();
    } catch (err) {
      status.textContent = "Live pull failed: " + err.message + ". Fill score/minute manually and continue.";
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  }

  // ============ INIT ============
  function populateDropdown() {
    const sel = $("matchupSelect");
    sel.innerHTML = window.MATCHUPS.map(m =>
      `<option value="${m.id}">${m.label}</option>`
    ).join("");
    sel.value = "BEL-SEN";
  }

  function loadMatchup(id) {
    const m = window.MATCHUPS.find(x => x.id === id);
    if (!m) return;
    state.matchup = m;
    state.poss = m.home.possDefault;
    state.tempo = m.tempo;
    state.pressure = m.pressure;
    state.live.active = false;
    state.live.homeGoals = 0;
    state.live.awayGoals = 0;
    state.live.minute = 0;
    $("possSlider").value = state.poss;
    $("possVal").textContent = state.poss + "%";
    $("tempoSlider").value = state.tempo;
    $("tempoVal").textContent = state.tempo;
    $("pressureSlider").value = state.pressure;
    $("pressureVal").textContent = state.pressure;
    $("liveToggle").checked = false;
    $("liveHomeGoals").value = 0;
    $("liveAwayGoals").value = 0;
    $("notes").textContent = m.notes || "";
    render();
  }

  function wireControls() {
    $("matchupSelect").addEventListener("change", (e) => loadMatchup(e.target.value));
    $("possSlider").addEventListener("input", (e) => {
      state.poss = parseInt(e.target.value, 10);
      $("possVal").textContent = state.poss + "%";
      render();
    });
    $("tempoSlider").addEventListener("input", (e) => {
      state.tempo = parseInt(e.target.value, 10);
      $("tempoVal").textContent = state.tempo;
      render();
    });
    $("pressureSlider").addEventListener("input", (e) => {
      state.pressure = parseInt(e.target.value, 10);
      $("pressureVal").textContent = state.pressure;
      render();
    });
    $("liveToggle").addEventListener("change", (e) => {
      state.live.active = e.target.checked;
      render();
    });
    $("liveHomeGoals").addEventListener("input", (e) => {
      state.live.homeGoals = parseInt(e.target.value, 10) || 0;
      render();
    });
    $("liveAwayGoals").addEventListener("input", (e) => {
      state.live.awayGoals = parseInt(e.target.value, 10) || 0;
      render();
    });
    $("goalMinute").addEventListener("input", () => render());
    $("comebackBoost").addEventListener("change", (e) => {
      state.live.comebackBoost = e.target.checked;
      render();
    });
    $("pullLive").addEventListener("click", pullLive);
    $("reset").addEventListener("click", () => loadMatchup(state.matchup.id));
  }

  document.addEventListener("DOMContentLoaded", () => {
    populateDropdown();
    wireControls();
    loadMatchup("BEL-SEN");
  });
})();
