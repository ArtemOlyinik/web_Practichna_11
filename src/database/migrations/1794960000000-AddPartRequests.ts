import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Заявки на підбір запчастини за VIN-кодом (варіант 7 - автозапчастини).
 * Саме VIN визначає кімнату Socket.IO request_<VIN>.
 */
export class AddPartRequests1794960000000 implements MigrationInterface {
  name = 'AddPartRequests1794960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."part_requests_status_enum" AS ENUM('NEW', 'IN_REVIEW', 'PART_FOUND', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "part_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vin_code" character varying(17) NOT NULL, "customer_email" character varying(254) NOT NULL, "requested_part" character varying(150) NOT NULL, "description" text, "status" "public"."part_requests_status_enum" NOT NULL DEFAULT 'NEW', "found_part_id" uuid, "manager_note" character varying(500), "notified_at" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_part_requests_vin_code" UNIQUE ("vin_code"), CONSTRAINT "PK_part_requests" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "part_requests" ADD CONSTRAINT "FK_part_requests_found_part" FOREIGN KEY ("found_part_id") REFERENCES "auto_parts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_part_requests_status" ON "part_requests" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_part_requests_status"`);
    await queryRunner.query(
      `ALTER TABLE "part_requests" DROP CONSTRAINT "FK_part_requests_found_part"`,
    );
    await queryRunner.query(`DROP TABLE "part_requests"`);
    await queryRunner.query(`DROP TYPE "public"."part_requests_status_enum"`);
  }
}
