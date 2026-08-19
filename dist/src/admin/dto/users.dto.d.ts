export declare class CreateStudentDto {
    username: string;
    password: string;
    name?: string;
    regNumber: string;
    mobile?: string;
    email?: string;
    classId?: string;
    departmentId?: string;
    institutionId?: string;
}
export declare class CreateTeacherDto {
    name?: string;
    username: string;
    password: string;
    mobile?: string;
    email?: string;
    departmentId?: string;
    institutionId?: string;
}
export declare class CreateAdminDto {
    name?: string;
    username: string;
    password: string;
    mobile?: string;
    email?: string;
    institutionId?: string;
}
export declare class UpdateUserDto {
    name?: string;
    username?: string;
    password?: string;
    regNumber?: string;
    mobile?: string;
    email?: string;
    classId?: string;
    departmentId?: string;
    institutionId?: string;
    isActive?: boolean;
}
