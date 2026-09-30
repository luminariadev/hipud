-- Add invoiceNumber to Review (locks a review to a specific paid invoice)
-- and add cancelToken to Order so only the order owner can cancel.
ALTER TABLE "Review" ADD COLUMN "invoiceNumber" TEXT;

ALTER TABLE "Order"
  ADD COLUMN "cancelToken" TEXT;

-- One cancel token per order; NULL allowed for rows created before this migration.
CREATE UNIQUE INDEX "Order_cancelToken_key" ON "Order"("cancelToken");
