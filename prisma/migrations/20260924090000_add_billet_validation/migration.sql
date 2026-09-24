-- Validation du billet d'entrée par l'enseignant du cours où l'élève se présente.
-- Migration uniquement additive : 3 colonnes ajoutées à "Billet".
-- Aucune ligne existante n'est supprimée ; les billets existants passent « en_attente ».

-- AlterTable
ALTER TABLE "Billet" ADD COLUMN     "statut" TEXT NOT NULL DEFAULT 'en_attente',
ADD COLUMN     "traiteAt" TIMESTAMP(3),
ADD COLUMN     "traitePar" TEXT;
