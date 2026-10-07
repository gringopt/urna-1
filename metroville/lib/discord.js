const DISCORD_API = "https://discord.com/api/v10";

export async function getDiscordUser(accessToken) {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Não foi possível obter o utilizador Discord.");
  }

  return response.json();
}

export async function getGuildMember(discordId) {
  const guildId = process.env.DISCORD_GUILD_ID;

  const response = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/${discordId}`,
    {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.text();

    console.error("Discord:", error);

    throw new Error(
      "Não foi possível verificar o servidor Discord."
    );
  }

  return response.json();
}

export async function checkDiscordPermission(discordId) {
  const member = await getGuildMember(discordId);

  if (!member) {
    return {
      allowed: false,
      reason: "NOT_IN_GUILD",
    };
  }

  const requiredRole = process.env.DISCORD_VOTER_ROLE_ID;

  if (!member.roles.includes(requiredRole)) {
    return {
      allowed: false,
      reason: "MISSING_ROLE",
    };
  }

  return {
    allowed: true,
    member,
  };
}