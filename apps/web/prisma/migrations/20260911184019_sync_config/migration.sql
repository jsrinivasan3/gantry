-- CreateTable
CREATE TABLE "sync_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "borough" TEXT NOT NULL,
    "bins" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_config_pkey" PRIMARY KEY ("id")
);
