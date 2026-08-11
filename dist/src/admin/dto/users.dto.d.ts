export declare class CreateStudentDto {
    username: string;
    password: string;
    regNumber: string;
    mobile?: string;
    email?: string;
    classId?: string;
}
export declare class CreateTeacherDto {
    name?: string;
    username: string;
    password: string;
    mobile?: string;
    email?: string;
}
export declare class CreateAdminDto {
    name?: string;
    username: string;
    password: string;
    mobile?: string;
    email?: string;
}
export declare class UpdateUserDto {
    name?: string;
    username?: string;
    password?: string;
    regNumber?: string;
    mobile?: string;
    email?: string;
    classId?: string;
    isActive?: boolean;
}
