-- Apply once after 001; fresh installs already have the updated size constraint.
-- Preserve existing BLOBs while allowing uploads through 10 MiB inclusive.
ALTER TABLE images DROP CHECK chk_images_size,
  ADD CONSTRAINT chk_images_size CHECK (byte_size BETWEEN 1 AND 10485760);
