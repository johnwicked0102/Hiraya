// Shared by server and client components.
export const KIND_LABELS: Record<string, { label: string; hint: string; emoji: string }> = {
  story: { label: "Family story", hint: "A tale the family tells again and again", emoji: "📖" },
  memory: { label: "Memory of an ancestor", hint: "What you remember about someone", emoji: "🕯️" },
  recipe: { label: "Recipe", hint: "Ingredients, steps, and who taught it", emoji: "🍲" },
  tradition: { label: "Tradition", hint: "How the family celebrates and gathers", emoji: "🏮" },
  letter: { label: "Old letter or document", hint: "Transcribe it and attach the scan", emoji: "✉️" },
  interview: { label: "Interview", hint: "Record or transcribe a conversation with an elder", emoji: "🎙️" },
  lesson: { label: "Message for the future", hint: "Life lessons for generations to come", emoji: "🌱" },
};
