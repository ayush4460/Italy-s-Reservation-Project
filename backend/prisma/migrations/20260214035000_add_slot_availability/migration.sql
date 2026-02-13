-- CreateTable
CREATE TABLE "SlotAvailability" (
    "id" SERIAL NOT NULL,
    "restaurantId" INTEGER NOT NULL,
    "slotId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isSlotDisabled" BOOLEAN NOT NULL DEFAULT false,
    "isIndoorDisabled" BOOLEAN NOT NULL DEFAULT false,
    "isOutdoorDisabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlotAvailability_restaurantId_idx" ON "SlotAvailability"("restaurantId");

-- CreateIndex
CREATE INDEX "SlotAvailability_date_idx" ON "SlotAvailability"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SlotAvailability_slotId_date_key" ON "SlotAvailability"("slotId", "date");

-- AddForeignKey
ALTER TABLE "SlotAvailability" ADD CONSTRAINT "SlotAvailability_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotAvailability" ADD CONSTRAINT "SlotAvailability_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
