import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1743688380153 implements MigrationInterface {
    name = 'InitialSchema1743688380153';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_users_org_id"
            FOREIGN KEY ("org_id")
            REFERENCES "organizations"("org_id")
            ON DELETE SET NULL
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "employees"
            ADD CONSTRAINT "FK_employees_org_id"
            FOREIGN KEY ("org_id")
            REFERENCES "organizations"("org_id")
            ON DELETE SET NULL
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "employees"
            ADD CONSTRAINT "FK_employees_report_to"
            FOREIGN KEY ("report_to")
            REFERENCES "employees"("id")
            ON DELETE SET NULL
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "employees"
            ADD CONSTRAINT "FK_employees_user_id"
            FOREIGN KEY ("user_id")
            REFERENCES "users"("user_id")
            ON DELETE NO ACTION
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "personal"
            ADD CONSTRAINT "FK_personal_employee_id"
            FOREIGN KEY ("employee_id")
            REFERENCES "employees"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "bank_info"
            ADD CONSTRAINT "FK_bank_info_employee_id"
            FOREIGN KEY ("employee_id")
            REFERENCES "employees"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "dropdown_values"
            ADD CONSTRAINT "FK_dropdown_values_type_id"
            FOREIGN KEY ("type_id")
            REFERENCES "dropdown_types"("type_id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "leaves"
            ADD CONSTRAINT "FK_leaves_employee_id"
            FOREIGN KEY ("employee_id")
            REFERENCES "employees"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "leaves"
            ADD CONSTRAINT "FK_leaves_approved_by"
            FOREIGN KEY ("approved_by")
            REFERENCES "employees"("id")
            ON DELETE SET NULL
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "leave_balances"
            ADD CONSTRAINT "FK_leave_balances_employee_id"
            FOREIGN KEY ("employee_id")
            REFERENCES "employees"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "leave_rules"
            ADD CONSTRAINT "FK_leave_rules_org_id"
            FOREIGN KEY ("org_id")
            REFERENCES "organizations"("org_id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "employee_leave_rules"
            ADD CONSTRAINT "FK_employee_leave_rules_employee_id"
            FOREIGN KEY ("employee_id")
            REFERENCES "employees"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "employee_leave_rules"
            ADD CONSTRAINT "FK_employee_leave_rules_rule_id"
            FOREIGN KEY ("rule_id")
            REFERENCES "leave_rules"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);

        // Insert data in correct order
        // 1. Insert organizations
        await queryRunner.query(`
            INSERT INTO "organizations" (
                org_id, org_name, location, domain
            ) VALUES (
                1, 'Auxai Technologies PVT LTD', 'Qatar', 'auxaitech.com'
            )
        `);

        // 2. Insert users
        await queryRunner.query(`
            INSERT INTO "users" (
                username, email, password, role, org_id
            ) VALUES (
                'abdulla', 'abdullahshaikh@auxaitech.com', 'Aminabi@2255', 'superadmin', 1
            )
        `);

        // 3. Insert dropdown_types (needed for dropdown_values)
        await queryRunner.query(`
            INSERT INTO "dropdown_types" (type_name)
            VALUES
                ('department'),
                ('sub_department'),
                ('work_location'),
                ('employee_type'),
                ('designation'),
                ('leave_type'),
                ('marital_status'),
                ('blood_group'),
                ('job_title'),
                ('currency')
        `);

        // 4. Insert dropdown_values (including currencies)
        await queryRunner.query(`
            INSERT INTO "dropdown_values" (
                type_id, value_name, sort_order, is_active
            ) VALUES
                (1, 'BA Team', 1, true),
                (1, 'BI & Analytics', 2, true),
                (1, 'Development', 3, true),
                (1, 'Human Resources', 4, true),
                (1, 'Integration Team', 5, true),
                (1, 'Customer Support', 6, true),
                (1, 'Management', 7, true),
                (1, 'Maximo', 8, true),
                (1, 'PMO', 9, true),
                (1, 'Support & Enhancement Team', 10, true),
                (2, 'Frontend Development', 1, true),
                (2, 'Backend Development', 2, true),
                (2, 'DevOps', 3, true),
                (2, 'Quality Assurance', 4, true),
                (2, 'UI/UX Design', 5, true),
                (2, 'Digital Marketing', 6, true),
                (2, 'Content Marketing', 7, true),
                (2, 'Accounts Payable', 8, true),
                (2, 'Accounts Receivable', 9, true),
                (2, 'Recruitment', 10, true),
                (2, 'Training & Development', 11, true),
                (3, 'On-site', 1, true),
                (3, 'Remote', 2, true),
                (3, 'Hybrid', 3, true),
                (3, 'Field Work', 4, true),
                (3, 'Client Site', 5, true),
                (4, 'Full-time', 1, true),
                (4, 'Part-time', 2, true),
                (4, 'Contract', 3, true),
                (4, 'Intern', 4, true),
                (5, 'Junior', 1, true),
                (5, 'Mid-level', 2, true),
                (5, 'Senior', 3, true),
                (5, 'Lead', 4, true),
                (5, 'Manager', 5, true),
                (5, 'Director', 6, true),
                (5, 'VP', 7, true),
                (5, 'C-Level', 8, true),
                (6, 'Annual Leave', 1, true),
                (6, 'Sick Leave', 2, true),
                (6, 'Casual Leave', 3, true),
                (6, 'Maternity Leave', 4, true),
                (6, 'Emergency Leave', 5, true),
                (6, 'Unpaid Leave', 6, true),
                (6, 'Study Leave', 8, true),
                (6, 'Compensatory Leave', 9, true),
                (7, 'Single', 1, true),
                (7, 'Married', 2, true),
                (7, 'Divorced', 3, true),
                (7, 'Widowed', 4, true),
                (7, 'Separated', 5, true),
                (8, 'A+', 1, true),
                (8, 'A-', 2, true),
                (8, 'B+', 3, true),
                (8, 'B-', 4, true),
                (8, 'AB+', 5, true),
                (8, 'AB-', 6, true),
                (8, 'O+', 7, true),
                (8, 'O-', 8, true),
                (9, 'Business Analyst', 1, true),
                (9, 'BI Consultant', 2, true),
                (9, 'Trainee Primavera Consultant', 3, true),
                (9, 'Trainee Technical Consultant', 4, true),
                (9, 'Data Migration Consultant', 5, true),
                (9, 'Functional Consultant', 6, true),
                (9, 'Functional Lead', 7, true),
                (9, 'Junior Functional Consultant', 8, true),
                (9, 'P6 Technical Consultant', 9, true),
                (9, 'Primavera Functional Consultant', 10, true),
                (9, 'Trainee Primavera Consultant', 11, true),
                (9, 'HR Manager', 12, true),
                (9, 'HR Executive', 13, true),
                (9, 'Integration Consultant', 14, true),
                (9, 'Integration Lead', 15, true),
                (9, 'Trainee Primavera Consultant', 16, true),
                (9, 'CEO', 17, true),
                (9, 'EAM Lead', 18, true),
                (9, 'Functional Consultant', 19, true),
                (9, 'PM', 20, true),
                (9, 'PMO Lead', 21, true),
                (9, 'Associate Primavera Consultant', 22, true),
                (9, 'Senior Primavera Consultant', 23, true),
                (9, 'Technical Lead', 24, true),
                (9, 'Trainee Primavera Consultant', 25, true),
                (9, 'BA', 26, true),
                (10, 'QAR', 1, true),
                (10, 'INR', 2, true),
                (10, 'JPY', 3, true),
                (10, 'GBP', 4, true),
                (10, 'AUD', 5, true),
                (10, 'CAD', 6, true),
                (10, 'CHF', 7, true),
                (10, 'CNY', 8, true),
                (10, 'EUR', 9, true),
                (10, 'BRL', 10, true)
        `);

        // 5. Insert employees (after dropdown_values to satisfy currency foreign key)
        await queryRunner.query(`
            INSERT INTO "employees" (
                employee_id, first_name, last_name, email, bio, status, designation, phone, address,
                job_title, gender, department, is_probation, employment_type, joining_date, dob, ctc,
                user_id, org_id, report_to, currency
            ) VALUES (
                'EMP001', 'Abdulla', 'Shaikh', 'abdullahshaikh@auxaitech.com',
                'Experienced system administrator with expertise in cloud infrastructure.',
                'active', 'Manager', '+97450123456', 'West Bay, Doha, Qatar',
                'Senior System Administrator', 'male', 'IT', false, 'Full-time', '2022-05-15', '2000-02-11', 120000.00,
                1, 1, NULL, 'INR'
            )
        `);

        // 6. Insert remaining sample data
        await queryRunner.query(`
            INSERT INTO "personal" (
                employee_id, email, alternative_phone, blood_group, marital_status,
                wedding_anniversary, current_address, permanent_address
            ) VALUES (
                1, 'abdulla.personal@gmail.com', '+97450234567', 'O+', 'married',
                '2018-06-30', 'Apartment 501, Tower A, West Bay, Doha, Qatar',
                'Villa 23, Street 5, Mumbai, India'
            )
        `);

        await queryRunner.query(`
            INSERT INTO "bank_info" (
                employee_id, bank_name, account_holder_name, city, branch_name,
                ifsc_code, account_no, is_primary
            ) VALUES (
                1, 'Qatar National Bank', 'Abdulla Shaikh', 'Doha', 'West Bay',
                'QNB0001234', '12345678901234', true
            )
        `);

        await queryRunner.query(`
            INSERT INTO "rules" (
                name, type
            ) VALUES
                ('Loss of pay', 'leave'),
                ('Emergency', 'leave'),
                ('Casual', 'leave'),
                ('Consecutive Leave Limit', 'policy'),
                ('Annual Leave Quota', 'policy'),
                ('Probation Period Rules', 'policy'),
                ('Overtime Compensation', 'compensation'),
                ('Travel Allowance', 'compensation')
        `);

        // Insert leave_rules after dependencies
        await queryRunner.query(`
            INSERT INTO "leave_rules" (
                org_id, leave_type, max_allowed, carry_forward_max, accrual_rate, is_active, applicable_gender, min_tenure_months
            ) VALUES
                (1, 'casual', 11.00, 0.00, NULL, true, NULL, 0),
                (1, 'sick', 2.00, 0.00, NULL, true, NULL, 0),
                (1, 'emergency', 3.00, 0.00, 1.25, true, NULL, 6),
                (1, 'maternity', 180.00, 0.00, NULL, true, 'female', 12),
                (1, 'annual', 11.00, 10.00, NULL, true, NULL, 0),
                (1, 'lossOfPay', 365.00, 0.00, NULL, true, NULL, 0)
        `);
        await queryRunner.query(`
            INSERT INTO public.tax_regimes (org_id, "taxBrackets", name, "currency", "isActive", "createdAt")
            VALUES (
                1,
                '[{"minAmount":0,"maxAmount":50000,"rate":0.05},{"minAmount":50001,"maxAmount":100000,"rate":0.1},{"minAmount":100001,"maxAmount":null,"rate":0.15}]'::jsonb,
                'Qatar Tax Plan 2025 (QAR)',
                'QAR',
                true,
                CURRENT_TIMESTAMP
            );
        `);

        await queryRunner.query(`
            INSERT INTO tax_regimes (org_id, "taxBrackets", name, currency, "isActive", "createdAt", "updatedAt")
            VALUES (
                1,
                '[{"minAmount":0,"maxAmount":1163887.6,"rate":0.05},{"minAmount":1164120.88,"maxAmount":2327775.2,"rate":0.1},{"minAmount":2328008.48,"maxAmount":null,"rate":0.15}]'::jsonb,
                'Qatar Tax Plan 2025 (INR)',
                'INR',
                true,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "employee_leave_rules" DROP CONSTRAINT IF EXISTS "FK_employee_leave_rules_rule_id"`);
        await queryRunner.query(`ALTER TABLE "employee_leave_rules" DROP CONSTRAINT IF EXISTS "FK_employee_leave_rules_employee_id"`);
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP CONSTRAINT IF EXISTS "FK_leave_rules_org_id"`);
        await queryRunner.query(`ALTER TABLE "leave_balances" DROP CONSTRAINT IF EXISTS "FK_leave_balances_employee_id"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "FK_leaves_approved_by"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "FK_leaves_employee_id"`);
        await queryRunner.query(`ALTER TABLE "dropdown_values" DROP CONSTRAINT IF EXISTS "FK_dropdown_values_type_id"`);
        await queryRunner.query(`ALTER TABLE "bank_info" DROP CONSTRAINT IF EXISTS "FK_bank_info_employee_id"`);
        await queryRunner.query(`ALTER TABLE "personal" DROP CONSTRAINT IF EXISTS "FK_personal_employee_id"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "FK_employees_user_id"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "FK_employees_report_to"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "FK_employees_org_id"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "FK_employees_currency"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_org_id"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS "employee_leave_rules"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "leave_rules"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "leave_balances"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "leaves"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "rules"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dropdown_values"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dropdown_types"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "bank_info"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "personal"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "employees"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);

        // Drop enums
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."leaves_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."leaves_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."employees_gender_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."employees_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);

        // Clear TypeORM metadata
        await queryRunner.query(`DROP TABLE IF EXISTS typeorm_metadata`);
    }
}