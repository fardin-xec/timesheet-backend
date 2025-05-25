import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedBankInfoData1748157914920 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
         await queryRunner.query(`
      INSERT INTO bank_info (
        employee_id, bank_name, account_holder_name, branch_name, 
        ifsc_code, swift_code, account_no, is_primary, "createdAt", "updatedAt"
      ) VALUES 
       (23, 'Axis Bank', 'Gowtham Ramesh', 'MEDAVAKKAM', 'UTIB0001119', 'AXISINBB083', '924010074797590', true, NOW(), NOW()),
      (27, 'Axis Bank', 'Mohamed Athil', 'DINDIGUL', 'UTIB0000352', 'AXISINBB352', '923010070522351', true, NOW(), NOW()),
      (24, 'Axis Bank', 'Swathi S', 'SALEM AGRAHARAM', 'UTIB0004598', 'AXISINBB170', '925010002938418', true, NOW(), NOW()),
      (42, 'Axis Bank', 'Jilkapally Pavan Chander', 'UPPAL KALAN, ANDHRA PRADESH', 'UTIB0000890', 'AXISINBB027', '924010071481841', true, NOW(), NOW()),
      (41, 'Axis Bank', 'Mohseen Khan', 'GAJRAULA', 'UTIB0001470', '', '924010039776949', true, NOW(), NOW()),
      (43, 'Axis Bank', 'Rizwan Khan', 'AMROHA', 'UTIB0001157', 'AXISINBB157', '924010065811171', true, NOW(), NOW()),
      (9, 'Axis Bank', 'Abdulla Abdul Latif Shaikh', 'SANQUELIM GOA', 'UTIB0002755', 'AXISINBB078', '924010067784330', true, NOW(), NOW()),
      (21, 'Axis Bank', 'Afaq Khan', 'ASHOKA GARDEN, BHOPAL', 'UTIB0003154', 'AXISINBB044', '925010000588446', true, NOW(), NOW()),
      (38, 'Axis Bank', 'Karthik Garg', 'KAMLA NAGAR', 'UTIB0001588', 'AXISINBB1588', '922010036650761', true, NOW(), NOW()),
      (37, 'Axis Bank', 'Hasan Rayyan', 'SAMBHAL', 'UTIB0001616', 'AXISINBB282', '924010065805396', true, NOW(), NOW()),
      (28, 'Axis Bank', 'Md Faizan Ahmed', 'BHAGALPUR, BIHAR', 'UTIB0000316', 'AXISINBB316', '924010051497523', true, NOW(), NOW()),
      (10, 'Axis Bank', 'Saood Khalid Sayyed', 'SANQUELIM GOA', 'UTIB0002755', 'AXISINBB078', '924010024372329', true, NOW(), NOW()),
      (46, 'Axis Bank', 'Sonam Jain', 'BOMBAY HOSPITAL SQUARE INDORE', 'UTIB0003029', 'axisinbb568', '924010074748190', true, NOW(), NOW()),
      (13, 'Axis Bank', 'Zareen', 'PANCHKULA', 'UTIB0000067', 'AXISINBB067', '916010041474939', true, NOW(), NOW()),
      (16, 'Axis Bank', 'Navaid Ali', 'MORADABAD UTTAR PRADESH', 'UTIB0000282', 'AXISINBB282', '924010070759930', true, NOW(), NOW()),
      (45, 'Axis Bank', 'Shivani Padmanabhan', 'PAYYANNUR', 'UTIB0001096', 'AXISINBBA18', '924010070774722', true, NOW(), NOW()),
      (39, 'Axis Bank', 'T Kavya', 'CHALLAKERE', 'UTIB0002868', 'AXISINBB2868', '924010065065334', true, NOW(), NOW()),
      (20, 'Axis Bank', 'Yanamala Venkatramana Reddy', 'RANGA COMPLEX M G ROAD', 'UTIB0005157', 'AXISINBB', '5395567813', true, NOW(), NOW()),
      (48, 'Axis Bank', 'Chokku Vineeth Kumar', 'SHANTINIKETAN', 'UTIB0002946', 'AXISINBB514', '921010008046429', true, NOW(), NOW()),
      (22, 'Axis Bank', 'Amir Khan', 'HARTHALA MORADABAD', 'UTIB0003735', '', '924010071482006', true, NOW(), NOW()),
      (25, 'Axis Bank', 'Ayush Singhania', 'ROSHAN PURA NAJAFGARH', 'UTIB0004391', 'AXISINBB391', '924010026678210', true, NOW(), NOW()),
      (26, 'Axis Bank', 'Chaitrashree A S', 'CHALLAKERE', 'UTIB0002868', '', '924010062119117', true, NOW(), NOW()),
      (40, 'Axis Bank', 'Manasa Acharya', 'KOTESHWARA', 'UTIB0005879', 'AXISINBB002', '924010065064917', true, NOW(), NOW()),
      (49, 'HDFC Bank', 'Vivek Singh', 'NOIDA SEC 50 - UTTAR PRADESH', 'HDFC0000728', 'HDFCINBBDEL', '50100619347001', true, NOW(), NOW()),
      (32, 'Axis Bank', 'Azim Faraz Ali', 'AMROHA', 'UTIB0001157', '', '925010000911985', true, NOW(), NOW()),
      (34, 'ICICI Bank', 'Noor Ahmed Ansari', 'JORHAT', 'ICIC0000473', 'ICICINBBXXX', '634301569194', true, NOW(), NOW()),
      (30, 'Axis Bank', 'Sanad Sahu', 'KODICHIKKANAHALLI', 'UTIB0003266', 'AXISINBB', '925010000583878', true, NOW(), NOW()),
      (31, 'Axis Bank', 'Saranya Sivaraj', 'CHENNAI', 'UTIB0000006', 'AXISINBB006', '921010052559977', true, NOW(), NOW()),
      (29, 'HDFC Bank', 'Vennapusa Sudharshan Reddy', 'CUDDAPAH - ANDHRA PRADESH', 'HDFC0000704', 'HDFCINBB', '50100681826267', true, NOW(), NOW()),
      (47, 'Axis Bank', 'Talagapu Sobhanababu', 'SANJEEVA REDDY NAGAR,HYDERABAD', 'UTIB0000289', '', '921010049003078', true, NOW(), NOW()),
      (8, 'Axis Bank', 'Wahida Taj Mohammad Shah', 'NEHRU NAGAR KURLA EAST', 'UTIB0004229', 'AXISINBBXXX', '925010016179762', true, NOW(), NOW()),
      (18, 'AU Small Finance Bank', 'Sanjay Chirania', 'JAIPUR JAWAHAR NAGAR', 'AUBL0002661', 'AUBLINBBXXX', '2402266159865830', true, NOW(), NOW()),
      (11, 'Axis Bank', 'Abinaiyasree Sivasankar', 'TIRUCHENGODE, TAMIL NADU', 'UTIB0000690', 'AXISINBB118', '925010008542909', true, NOW(), NOW()),
      (6, 'Commercial bank of Qatar', 'ABDULLAH TANVEER', '', '', '', 'QA68CBQA000000004610575708001', true, NOW(), NOW()),
      (44, 'Commercial bank of Qatar', 'Sathya Raj Panneer Selvam', '', '', '', 'QA32CBQA000000004610552954001', true, NOW(), NOW()),
      (14, 'Commercial bank of Qatar', 'MOHAMMAD SHAHBAAZ', '', '', '', 'QA32CBQA000000004730571956101', true, NOW(), NOW()),
      (19, 'Commercial bank of Qatar', 'YASHWANTH MANDYA BHADRANARASIMHACHAR', '', '', '', 'QA19CBQA000000004730571052101', true, NOW(), NOW()),
      (33, 'Commercial bank of Qatar', 'Gulam Hafiz Navid Adhikari Adhikari', '', '', '', 'QA04CBQA000000004730692893101', true, NOW(), NOW()),
      (36, 'Commercial bank of Qatar', 'Mohd Faizuddin Syed Shakil Uddin', '', '', '', 'QA32CBQA000000473065330010101', true, NOW(), NOW()),
      (7, 'Commercial bank of Qatar, 'SUMY PAPPACHEN', '', '', '', 'QA22CBQA000000004060639910101', true, NOW(), NOW()),
      (17, 'Commercial bank of Qatar', 'SHABAAZ SHOUKATHALI MOHSIN', '', '', '', 'QA72CBQA000000473053230012101', true, NOW(), NOW()),
      (12, 'Commercial bank of Qatar', 'JOSE ARISTOTLE LAWERENCE LUDWICK NORONHA', '', '', '', 'QA42CBQA000000473053250012101', true, NOW(), NOW()),
      (35, 'Commercial bank of Qatar', 'ASHINA AZAD SHANIFA', '', '', '', 'QA74CBQA000000401036360017001', true, NOW(), NOW())
    

      
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
         await queryRunner.query(`
      DELETE FROM bank_info 
      WHERE account_holder_name IN (
        'Gowtham Ramesh', 'Mohamed Athil', 'Swathi S', 'Jilkapally Pavan Chander',
        'Mohseen Khan', 'Rizwan Khan', 'Abdulla Abdul Latif Shaikh', 'Afaq Khan',
        'Karthik Garg', 'Hasan Rayyan', 'Md Faizan Ahmed', 'Saood Khalid Sayyed',
        'Sonam Jain', 'Zareen', 'Navaid Ali', 'Shivani Padmanabhan', 'T Kavya',
        'Yanamala Venkatramana Reddy', 'Chokku Vineeth Kumar', 'Amir Khan',
        'Ayush Singhania', 'Chaitrashree A S', 'Manasa Acharya', 'Vivek Singh',
        'Azim Faraz Ali', 'Noor Ahmed Ansari', 'Sanad Sahu', 'Saranya Sivaraj',
        'Vennapusa Sudharshan Reddy', 'Talagapu Sobhanababu', 'Wahida Taj Mohammad Shah',
        'Sanjay Chirania', 'Abinaiyasree Sivasankar', 'Priyanka'
      )
    `);
    }

}
