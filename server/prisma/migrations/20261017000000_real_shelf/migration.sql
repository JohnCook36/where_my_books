-- CreateTable
CREATE TABLE "ShelfLayout" (
    "userId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShelfLayout_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ShelfOperation" (
    "userId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resultRevision" INTEGER NOT NULL,
    "undo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShelfOperation_pkey" PRIMARY KEY ("userId","requestId")
);

-- CreateTable
CREATE TABLE "StorageRoom" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shelf" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'oak',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shelf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShelfSection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "shelfId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShelfSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShelfRow" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 80,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShelfRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShelfPlacement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "copyId" UUID NOT NULL,
    "rowId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShelfPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorageRoom_userId_idx" ON "StorageRoom"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StorageRoom_id_userId_key" ON "StorageRoom"("id", "userId");

-- CreateIndex
CREATE INDEX "Shelf_userId_idx" ON "Shelf"("userId");

-- CreateIndex
CREATE INDEX "Shelf_roomId_userId_idx" ON "Shelf"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Shelf_id_userId_key" ON "Shelf"("id", "userId");

-- CreateIndex
CREATE INDEX "ShelfSection_userId_idx" ON "ShelfSection"("userId");

-- CreateIndex
CREATE INDEX "ShelfSection_shelfId_userId_idx" ON "ShelfSection"("shelfId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShelfSection_id_userId_key" ON "ShelfSection"("id", "userId");

-- CreateIndex
CREATE INDEX "ShelfRow_userId_idx" ON "ShelfRow"("userId");

-- CreateIndex
CREATE INDEX "ShelfRow_sectionId_userId_idx" ON "ShelfRow"("sectionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShelfRow_id_userId_key" ON "ShelfRow"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShelfPlacement_copyId_key" ON "ShelfPlacement"("copyId");

-- CreateIndex
CREATE INDEX "ShelfPlacement_userId_idx" ON "ShelfPlacement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShelfPlacement_copyId_userId_key" ON "ShelfPlacement"("copyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShelfPlacement_rowId_position_key" ON "ShelfPlacement"("rowId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BookCopy_id_userId_key" ON "BookCopy"("id", "userId");

-- AddForeignKey
ALTER TABLE "ShelfLayout" ADD CONSTRAINT "ShelfLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfOperation" ADD CONSTRAINT "ShelfOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageRoom" ADD CONSTRAINT "StorageRoom_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shelf" ADD CONSTRAINT "Shelf_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shelf" ADD CONSTRAINT "Shelf_roomId_userId_fkey" FOREIGN KEY ("roomId", "userId") REFERENCES "StorageRoom"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfSection" ADD CONSTRAINT "ShelfSection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfSection" ADD CONSTRAINT "ShelfSection_shelfId_userId_fkey" FOREIGN KEY ("shelfId", "userId") REFERENCES "Shelf"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfRow" ADD CONSTRAINT "ShelfRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfRow" ADD CONSTRAINT "ShelfRow_sectionId_userId_fkey" FOREIGN KEY ("sectionId", "userId") REFERENCES "ShelfSection"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfPlacement" ADD CONSTRAINT "ShelfPlacement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfPlacement" ADD CONSTRAINT "ShelfPlacement_copyId_userId_fkey" FOREIGN KEY ("copyId", "userId") REFERENCES "BookCopy"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfPlacement" ADD CONSTRAINT "ShelfPlacement_rowId_userId_fkey" FOREIGN KEY ("rowId", "userId") REFERENCES "ShelfRow"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "Shelf" ADD CONSTRAINT "Shelf_theme_check" CHECK ("theme" IN ('oak', 'ivory', 'night'));
ALTER TABLE "ShelfRow" ADD CONSTRAINT "ShelfRow_capacity_check" CHECK ("capacity" BETWEEN 1 AND 200);
ALTER TABLE "ShelfPlacement" ADD CONSTRAINT "ShelfPlacement_position_check" CHECK ("position" >= 0);

ALTER TABLE "ShelfRow" ADD CONSTRAINT "ShelfRow_position_check" CHECK ("position" >= 0);
ALTER TABLE "ShelfSection" ADD CONSTRAINT "ShelfSection_position_check" CHECK ("position" >= 0);
