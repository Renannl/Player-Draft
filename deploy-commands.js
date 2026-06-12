require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Cria o painel de inscrição")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("inscritos")
    .setDescription("Lista os jogadores inscritos")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("setup-painel")
    .setDescription("Cria o painel de inscrições")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("draft")
    .setDescription("Inicia um draft"),

  new SlashCommandBuilder()
    .setName("encerrar-draft")
    .setDescription("Encerra o draft"),
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID,
    ),
    { body: commands },
  );

  console.log("Comandos registrados!");
})();
