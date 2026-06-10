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

const PLAYERS_FILE = path.join(__dirname, "data", "players.json");

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

    if (interaction.commandName === "inscritos") {
      const players = await getPlayers();

      if (!players.length) {
        return interaction.reply("Nenhum jogador inscrito.");
      }

      const content = players
        .map((player) => {
          return [
            `**${player.username}**`,
            `${ROLE_EMOJIS[player.preferences[0]]} ⭐⭐⭐⭐⭐ `,
            `${ROLE_EMOJIS[player.preferences[1]]} ⭐⭐⭐⭐`,
            `${ROLE_EMOJIS[player.preferences[2]]} ⭐⭐⭐`,
            `${ROLE_EMOJIS[player.preferences[3]]} ⭐⭐`,
            `${ROLE_EMOJIS[player.preferences[4]]} ⭐`,
          ].join("\n");
        })
        .join("\n\n");

      await interaction.reply({
        content,
        ephemeral: true,
      });
    }

    return;
  }

  if (interaction.isButton()) {
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
