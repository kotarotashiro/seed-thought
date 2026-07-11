import { prisma } from "@/lib/db/prisma";
import type { DecodeOutput } from "@/lib/ai/types";

export async function promotePatternAsset(
  learningCardId: string,
  decode: DecodeOutput | null | undefined
): Promise<void> {
  const pattern = decode?.extractedPattern;
  if (!pattern) return;

  try {
    await prisma.patternAsset.upsert({
      where: { learningCardId },
      create: {
        learningCardId,
        sourceKind: "decode",
        name: pattern.name,
        structure: pattern.structure,
        variableSlotsJson: JSON.stringify(pattern.variableSlots ?? []),
        transferScope: pattern.transferScope,
        usageNote: pattern.usageNote ?? null,
        tagsJson: JSON.stringify(decode.synthesisTags ?? []),
      },
      update: {
        name: pattern.name,
        structure: pattern.structure,
        variableSlotsJson: JSON.stringify(pattern.variableSlots ?? []),
        transferScope: pattern.transferScope,
        usageNote: pattern.usageNote ?? null,
        tagsJson: JSON.stringify(decode.synthesisTags ?? []),
      },
    });
  } catch (error) {
    console.warn(
      "[assets/promotePattern] PatternAsset promotion failed:",
      error instanceof Error ? error.message : error
    );
  }
}
