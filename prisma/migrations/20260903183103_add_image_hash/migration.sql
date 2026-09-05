/*
  Warnings:

  - A unique constraint covering the columns `[imageHash]` on the table `Posts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `imageHash` to the `Posts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Posts" ADD COLUMN     "imageHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Posts_imageHash_key" ON "Posts"("imageHash");
