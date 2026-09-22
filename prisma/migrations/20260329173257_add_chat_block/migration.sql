-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "chatBlocked" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "chatBlocked" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "GlobalSetting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "GlobalSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalSetting_key_key" ON "GlobalSetting"("key");
