import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHalfDayAndAttachmentFields1743688400000 implements MigrationInterface {
    name = 'AddHalfDayAndAttachmentFields1743688400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create half_day_type enum

        

        // Add new columns to leaves table
        await queryRunner.query(`
            ALTER TABLE "leaves" 
            ADD COLUMN "is_half_day" boolean DEFAULT false,
            ADD COLUMN "half_day_type" "public"."leaves_halfdaytype_enum",
            ADD COLUMN "attachment_url" text
        `);

        // Update applied_days column to support decimal values for half days
        await queryRunner.query(`
            ALTER TABLE "leaves" 
            ALTER COLUMN "applied_days" TYPE decimal(4,1)
        `);

        // Update existing leave rules to match the new requirements
        await queryRunner.query(`
            UPDATE "leave_rules" 
            SET "max_allowed" = 11.0, "carry_forward_max" = 10.0 
            WHERE "leave_type" = 'annual'
        `);

        await queryRunner.query(`
            UPDATE "leave_rules" 
            SET "max_allowed" = 11.0, "carry_forward_max" = 0.0 
            WHERE "leave_type" = 'casual'
        `);

        await queryRunner.query(`
            UPDATE "leave_rules" 
            SET "max_allowed" = 2.0, "carry_forward_max" = 0.0 
            WHERE "leave_type" = 'sick'
        `);

        await queryRunner.query(`
            UPDATE "leave_rules" 
            SET "max_allowed" = 3.0, "carry_forward_max" = 0.0 
            WHERE "leave_type" = 'emergency'
        `);

        await queryRunner.query(`
            UPDATE "leave_rules" 
            SET "max_allowed" = 365.0, "carry_forward_max" = 0.0 
            WHERE "leave_type" = 'lossOfPay'
        `);

        // Add maternity leave rule with different values for India and Qatar
        await queryRunner.query(`
            UPDATE "leave_rules" 
            SET "max_allowed" = 182.0, "carry_forward_max" = 0.0 
            WHERE "leave_type" = 'maternity'
        `);

        // Add validation constraint to ensure half_day_type is only set when is_half_day is true
        await queryRunner.query(`
            ALTER TABLE "leaves" 
            ADD CONSTRAINT "CHK_half_day_type_consistency" 
            CHECK (
                (is_half_day = true AND half_day_type IS NOT NULL) OR 
                (is_half_day = false AND half_day_type IS NULL)
            )
        `);

        // Create index for better performance on half-day queries
        await queryRunner.query(`
            CREATE INDEX "IDX_leaves_half_day" ON "leaves" ("is_half_day") 
            WHERE "is_half_day" = true
        `);

        // Create index for attachment queries
        await queryRunner.query(`
            CREATE INDEX "IDX_leaves_attachment" ON "leaves" ("attachment_url") 
            WHERE "attachment_url" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_leaves_attachment"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_leaves_half_day"`);

        // Drop constraint
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "CHK_half_day_type_consistency"`);

        // Remove new columns
        await queryRunner.query(`
            ALTER TABLE "leaves" 
            DROP COLUMN IF EXISTS "attachment_url",
            DROP COLUMN IF EXISTS "half_day_type",
            DROP COLUMN IF EXISTS "is_half_day"
        `);

        // Drop enum type
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."leaves_halfdaytype_enum"`);

        // Revert applied_days column to integer
        await queryRunner.query(`
            ALTER TABLE "leaves" 
            ALTER COLUMN "applied_days" TYPE integer
        `);
    }
}