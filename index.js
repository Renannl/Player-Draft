require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const fs = require("fs-extra");
const path = require("path");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const PAGE_SIZE = 5;

function buildPlayersPage(players, page) {
  const start = page * PAGE_SIZE;
  const pagePlayers = players.slice(start, start + PAGE_SIZE);

  return pagePlayers
    .map((player) => {
      return [
        `**${player.username}**`,
        `${ROLE_EMOJIS[player.preferences[0]]} ⭐⭐⭐⭐⭐`,
        `${ROLE_EMOJIS[player.preferences[1]]} ⭐⭐⭐⭐`,
        `${ROLE_EMOJIS[player.preferences[2]]} ⭐⭐⭐`,
        `${ROLE_EMOJIS[player.preferences[3]]} ⭐⭐`,
        `${ROLE_EMOJIS[player.preferences[4]]} ⭐`,
      ].join("\n");
    })
    .join("\n\n");
}

const ROLE_OPTIONS = [
  {
    label: "Top",
    value: "TOP",
    emoji: { id: "1514255488043319296" },
  },
  {
    label: "Jungle",
    value: "JG",
    emoji: { id: "1514256131919183882" },
  },
  {
    label: "Mid",
    value: "MID",
    emoji: { id: "1514256166195167343" },
  },
  {
    label: "ADC",
    value: "ADC",
    emoji: { id: "1514256191314726913" },
  },
  {
    label: "Suporte",
    value: "SUP",
    emoji: { id: "1514256214601629877" },
  },
];

const ROLE_EMOJIS = {
  TOP: "<:Top_icon:1514255488043319296>",
  JG: "<:Jungle_icon:1514256131919183882>",
  MID: "<:Middle_icon:1514256166195167343>",
  ADC: "<:Bottom_icon:1514256191314726913>",
  SUP: "<:Support_icon:1514256214601629877>",
};

function getStepLabel(step) {
  const labels = {
    1: "principal",
    2: "segunda",
    3: "terceira",
    4: "quarta",
    5: "quinta",
  };

  return labels[step];
}

client.once("clientReady", () => {
  console.log(`Logado como ${client.user.tag}`);
});

const draftRegistrations = new Map();

const activeDraft = {
  captains: [],
  availablePlayers: [],
  teams: {},
  currentPick: 0,
};

const SNAKE_ORDER = [
  0, 1, 2, 3,
  3, 2, 1, 0,
  0, 1, 2, 3,
  3, 2, 1, 0,
];

const PLAYERS_FILE = path.join(__dirname, "data", "players.json");

function getRoleScore(player, role) {
  const index = player.preferences.indexOf(role);

  if (index === -1) return 0;

  return 5 - index;
}

function generateBalancedAssignments(players) {
  const MAX_PER_ROLE = 4;

  const assignments = {
    TOP: [],
    JG: [],
    MID: [],
    ADC: [],
    SUP: [],
  };

  const playerRole = new Map();

  for (const player of players) {
    const primaryRole = player.preferences[0];

    assignments[primaryRole].push(player);

    playerRole.set(player.discordId || player.username, primaryRole);
  }
  let changed = true;

  while (changed) {
    changed = false;

    const overloadedRole = Object.keys(assignments).find(
      (role) => assignments[role].length > MAX_PER_ROLE,
    );

    if (!overloadedRole) {
      break;
    }
    let bestMove = null;

    for (const player of assignments[overloadedRole]) {
      const currentIndex = player.preferences.indexOf(overloadedRole);

      for (
        let targetIndex = currentIndex + 1;
        targetIndex < player.preferences.length;
        targetIndex++
      ) {
        const targetRole = player.preferences[targetIndex];

        if (assignments[targetRole].length >= MAX_PER_ROLE) {
          continue;
        }

        const loss = targetIndex - currentIndex;

        if (!bestMove || loss < bestMove.loss) {
          bestMove = {
            player,
            from: overloadedRole,
            to: targetRole,
            loss,
          };
        }
      }
    }
    if (!bestMove) {
      break;
    }

    assignments[bestMove.from] = assignments[bestMove.from].filter(
      (p) =>
        (p.discordId || p.username) !==
        (bestMove.player.discordId || bestMove.player.username),
    );

    assignments[bestMove.to].push(bestMove.player);

    changed = true;
  }

  return assignments;
}

function getRoleOptions(excludedRoles = []) {
  return ROLE_OPTIONS.filter((role) => !excludedRoles.includes(role.value));
}

async function getPlayers() {
  const data = await fs.readJson(PLAYERS_FILE);
  return data.players;
}

async function savePlayer(discordId, playerData) {
  const data = await fs.readJson(PLAYERS_FILE);

  const existingIndex = data.players.findIndex(
    (p) => p.discordId === discordId,
  );

  const player = {
    discordId,
    username: playerData.username,
    preferences: playerData.preferences,
    registeredAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    data.players[existingIndex] = player;
  } else {
    data.players.push(player);
  }

  await fs.writeJson(PLAYERS_FILE, data, { spaces: 2 });
}

const PANEL_FILE = path.join(__dirname, "data", "panel.json");

async function getPanelData() {
  return await fs.readJson(PANEL_FILE);
}

async function savePanelData(data) {
  await fs.writeJson(PANEL_FILE, data, { spaces: 2 });
}

async function updateRegistrationPanel() {
  const panel = await getPanelData();

  if (!panel.messageId || !panel.channelId) {
    return;
  }

  const players = await getPlayers();

  const grouped = generateBalancedAssignments(players);

  const totalPlayers = players.length;

  const remainder = totalPlayers % 5;
  const missing = remainder === 0 ? 0 : 5 - remainder;

  const content = `
🏆 ** TURISTAS DO CLASH**

Total de inscritos: ${totalPlayers}

${missing > 0 ? `⚠️ Faltam ${missing} jogador(es) para fechar mais um time completo.\n` : "✅ Times completos.\n"}

${ROLE_EMOJIS.TOP} **TOP (${grouped.TOP.length})**
${grouped.TOP.length ? grouped.TOP.map((p) => `• ${p.username}`).join("\n") : "Nenhum"}

${ROLE_EMOJIS.JG} **JG (${grouped.JG.length})**
${grouped.JG.length ? grouped.JG.map((p) => `• ${p.username}`).join("\n") : "Nenhum"}

${ROLE_EMOJIS.MID} **MID (${grouped.MID.length})**
${grouped.MID.length ? grouped.MID.map((p) => `• ${p.username}`).join("\n") : "Nenhum"}

${ROLE_EMOJIS.ADC} **ADC (${grouped.ADC.length})**
${grouped.ADC.length ? grouped.ADC.map((p) => `• ${p.username}`).join("\n") : "Nenhum"}

${ROLE_EMOJIS.SUP} **SUP (${grouped.SUP.length})**
${grouped.SUP.length ? grouped.SUP.map((p) => `• ${p.username}`).join("\n") : "Nenhum"}
`;

  const channel = await client.channels.fetch(panel.channelId);

  const message = await channel.messages.fetch(panel.messageId);

  await message.edit(content);
}

function buildDraftMessage() {
  let text = "🏆 DRAFT\n\n";

  for (const captain of activeDraft.captains) {
    text += `💎 ${captain.username}\n`;

    const team =
      activeDraft.teams[captain.discordId];

    if (!team.length) {
      text += "Nenhum jogador\n";
    } else {
      text += team
        .map(p => `• ${p.username}`)
        .join("\n");
    }

    text += "\n\n";
  }

  return text;
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "setup") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("register")
          .setLabel("Fazer Inscrição")
          .setStyle(ButtonStyle.Primary),
      );

      await interaction.reply({
        content:
          "🏆 ** TORNEIO PILOTO TURISTAS DO CLASH**\n\nClique abaixo para realizar sua inscrição.",
        components: [row],
      });
    }

    if (interaction.commandName === "draft") {
      const players = await getPlayers();

      if (players.length < 8) {
        return interaction.reply({
          content: "É necessário ter pelo menos 8 jogadores inscritos.",
          ephemeral: true,
        });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId("select_captains")
        .setPlaceholder("Escolha os 4 capitães")
        .setMinValues(4)
        .setMaxValues(4)
        .addOptions(
          players.map((player) => ({
            label: player.username,
            value: player.discordId,
          })),
        );

      const row = new ActionRowBuilder().addComponents(select);

      await interaction.reply({
        content: "🏆 Escolha os 4 capitães do draft",
        components: [row],
      });
    }

    if (interaction.commandName === "setup-painel") {
      const message = await interaction.channel.send(
        "🏆 **TURISTAS DO CLASH**\n\nCarregando painel...",
      );

      await savePanelData({
        channelId: interaction.channel.id,
        messageId: message.id,
      });

      await updateRegistrationPanel();

      await interaction.reply({
        content: "✅ Painel criado.",
        ephemeral: true,
      });
    }

    if (interaction.commandName === "inscritos") {
      const players = await getPlayers();

      if (!players.length) {
        return interaction.reply("Nenhum jogador inscrito.");
      }

      const page = 0;
      const totalPages = Math.ceil(players.length / PAGE_SIZE);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`players_prev_${page}`)
          .setLabel("⬅️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),

        new ButtonBuilder()
          .setCustomId(`players_next_${page}`)
          .setLabel("➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(totalPages <= 1),
      );

      await interaction.reply({
        content:
          buildPlayersPage(players, page) +
          `\n\nPágina ${page + 1}/${totalPages}`,
        components: [row],
        ephemeral: true,
      });
    }

    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith("role_")) {

      const currentCaptain =
        activeDraft.captains[activeDraft.currentPick];

      if (interaction.user.id !== currentCaptain.discordId) {
        return interaction.reply({
          content: "Não é sua vez de escolher.",
          ephemeral: true,
        });
      }
      
      const role = interaction.customId.replace("role_", "");

      const players = activeDraft.availablePlayers.filter(
        player => player.preferences[0] === role
      );

      if (!players.length) {
        return interaction.reply({
          content: "Nenhum jogador disponível nessa rota.",
          ephemeral: true,
        });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId(`pick_${role}`)
        .setPlaceholder(`Escolha um ${role}`)
        .addOptions(
          players.map(player => ({
            label: player.username,
            value: player.discordId,
          }))
        );

      const row = new ActionRowBuilder().addComponents(select);

      await interaction.reply({
        content: `Jogadores da rota ${role}`,
        components: [row],
        ephemeral: true,
      });

      return;
    }
    if (
      interaction.customId.startsWith("players_prev_") ||
      interaction.customId.startsWith("players_next_")
    ) {
      const players = await getPlayers();

      const totalPages = Math.ceil(players.length / PAGE_SIZE);

      let page = Number(interaction.customId.split("_").pop());

      if (interaction.customId.startsWith("players_next_")) {
        page++;
      } else {
        page--;
      }

      page = Math.max(0, Math.min(page, totalPages - 1));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`players_prev_${page}`)
          .setLabel("⬅️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId(`players_next_${page}`)
          .setLabel("➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
      );

      await interaction.update({
        content:
          buildPlayersPage(players, page) +
          `\n\nPágina ${page + 1}/${totalPages}`,
        components: [row],
      });

      return;
    }

    if (interaction.customId === "register") {
      draftRegistrations.delete(interaction.user.id);

      const select = new StringSelectMenuBuilder()
        .setCustomId("role_step_1")
        .setPlaceholder("Escolha sua role principal")
        .addOptions(getRoleOptions());

      const row = new ActionRowBuilder().addComponents(select);

      await interaction.reply({
        content: "Escolha sua role principal:",
        components: [row],
        ephemeral: true,
      });
    }

    return;
  }
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith("pick_")) {
      const captainIndex =
        SNAKE_ORDER[activeDraft.currentPick];

      const currentCaptain =
        activeDraft.captains[captainIndex];

      const playerId = interaction.values[0];

      const pickedPlayer = activeDraft.availablePlayers.find(
        p => p.discordId === playerId
      );

      if (!pickedPlayer) {
        return interaction.reply({
          content: "Jogador já escolhido.",
          ephemeral: true,
        });
      }

      activeDraft.teams[currentCaptain.discordId]
        .push(pickedPlayer);

      activeDraft.availablePlayers =
        activeDraft.availablePlayers.filter(
          p => p.discordId !== playerId
        );

      activeDraft.currentPick++;

      const nextCaptainIndex =
        SNAKE_ORDER[activeDraft.currentPick];

      const nextCaptain =
        activeDraft.captains[nextCaptainIndex];

      if (!pickedPlayer) {
        return interaction.reply({
          content: "Jogador já escolhido.",
          ephemeral: true,
        });
      }

      await interaction.update({
        content:
          buildDraftMessage() +
          `\n Próximo pick: ${nextCaptain.username}`,
        components: [],
      });

      return;
    }
    if (interaction.customId === "select_captains") {
      const players = await getPlayers();

      activeDraft.captains = players.filter((player) =>
        interaction.values.includes(player.discordId),
      );

      activeDraft.availablePlayers = players.filter(
        (player) =>
          !interaction.values.includes(player.discordId),
      );

      activeDraft.teams = {};

      for (const captain of activeDraft.captains) {
        activeDraft.teams[captain.discordId] = [];
      }

      activeDraft.currentPick = 0;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("role_TOP")
          .setLabel("TOP")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("role_JG")
          .setLabel("JG")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("role_MID")
          .setLabel("MID")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("role_ADC")
          .setLabel("ADC")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("role_SUP")
          .setLabel("SUP")
          .setStyle(ButtonStyle.Primary)
      );

      const firstCaptain = activeDraft.captains[0];

      await interaction.update({
        content:
          `🏆 DRAFT INICIADO\n\n` +
          `Vez de: ${firstCaptain.username}`,
        components: [row],
      });

      return;
    }

    if (interaction.customId === "draft_pick") {
      await interaction.reply({
        content: "Draft pick recebido!",
        ephemeral: true,
      });

      return;
    }

    if (interaction.customId.startsWith("role_step_")) {
      const step = Number(interaction.customId.replace("role_step_", ""));

      const selectedRole = interaction.values[0];

      let player = draftRegistrations.get(interaction.user.id) || {
        username: interaction.user.username,
        preferences: [],
      };

      player.preferences.push(selectedRole);

      draftRegistrations.set(interaction.user.id, player);

      if (step === 5) {
        await savePlayer(interaction.user.id, player);

        await updateRegistrationPanel();

        const finalRoles = player.preferences
          .map((role) => ROLE_EMOJIS[role])
          .join(" → ");

        draftRegistrations.delete(interaction.user.id);

        await interaction.update({
          content: `✅ Inscrição concluída!\n\n${finalRoles}`,
          components: [],
        });

        return;
      }

      const nextStep = step + 1;

      const select = new StringSelectMenuBuilder()
        .setCustomId(`role_step_${nextStep}`)
        .setPlaceholder(`Escolha sua ${getStepLabel(nextStep)} role`)
        .addOptions(getRoleOptions(player.preferences));

      const row = new ActionRowBuilder().addComponents(select);

      await interaction.update({
        content: `Escolha sua ${getStepLabel(nextStep)} role:`,
        components: [row],
      });
    }

    return;
  }
});

client.login(process.env.TOKEN);
