// Compact emoji catalog for the picker (no external dependency).
const split = (s) => s.trim().split(/\s+/);

export const EMOJI_CATEGORIES = [
  {
    id: "smileys",
    icon: "😀",
    label: "چهره‌ها",
    emojis: split(
      "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👻 👽 🤖"
    ),
  },
  {
    id: "gestures",
    icon: "👍",
    label: "دست و بدن",
    emojis: split(
      "👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 👏 🙌 👐 🤲 💪 🦾 ✍️ 💅 🤳 👀 👁️ 🧠 🫶 🫡 🫠 🫣 🙋 🙆 🙅 🤷 🤦 💁 🙇"
    ),
  },
  {
    id: "hearts",
    icon: "❤️",
    label: "قلب و نماد",
    emojis: split(
      "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 ⚡ ✅ ❌ ❓ ❗ ⚠️ 🚫 ♻️ ➕ ➖ ✔️ ☑️ 🔔 🔕 📌 📍 🔒 🔓 🆗 🆕 🔴 🟢 🔵 🟡 🟣"
    ),
  },
  {
    id: "celebrate",
    icon: "🎉",
    label: "جشن",
    emojis: split(
      "🎉 🎊 🎈 🎁 🏆 🥇 🥈 🥉 🏅 🎯 🎮 🎵 🎶 🎤 🎧 🎬 📸 🍾 🥂 🍻 🎂 🍰 🧁 🍕 🍔 🍟 🌭 🍿 🍩 🍪 ☕ 🍵 🍎 🍌 🍉 🍓 🥑 🍅 🥕 🌶️"
    ),
  },
  {
    id: "nature",
    icon: "🌿",
    label: "طبیعت",
    emojis: split(
      "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦅 🦉 🐝 🦋 🐢 🐍 🐙 🐬 🐳 🌸 🌹 🌻 🌷 🌲 🌴 🍀 🌈 ☀️ 🌙 ⭐ ☁️ ❄️ 🌊"
    ),
  },
  {
    id: "work",
    icon: "💼",
    label: "کار",
    emojis: split(
      "💼 📁 📂 📄 📝 📊 📈 📉 📅 📆 🗓️ ⏰ ⏳ ⌛ 🕐 💻 🖥️ ⌨️ 🖱️ 📱 ☎️ 📧 📨 📎 🔗 🔍 🔧 🔨 ⚙️ 🛠️ 🧰 💡 🔑 🗝️ 📢 📣 🚀 ✈️ 🚗 🏠 🏢 💰 💳 🧾 📦"
    ),
  },
];
