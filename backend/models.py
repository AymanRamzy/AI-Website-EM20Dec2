from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
from datetime import datetime
import uuid
from enum import Enum

# Enums
class UserRole(str, Enum):
    PARTICIPANT = "participant"
    JUDGE = "judge"
    ADMIN = "admin"

class TeamMemberRole(str, Enum):
    ANALYST = "Analyst"
    DESIGNER = "Designer"
    STRATEGIST = "Strategist"
    COMMUNICATOR = "Communicator"

class TeamStatus(str, Enum):
    FORMING = "forming"
    COMPLETE = "complete"
    DISQUALIFIED = "disqualified"

class CompetitionStatus(str, Enum):
    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"

class CFOApplicationStatus(str, Enum):
    PENDING = "pending"
    AUTO_REJECTED = "auto_rejected"
    SHORTLISTED = "shortlisted"
    APPROVED = "approved"
    REJECTED = "rejected"
    WAITLISTED = "waitlisted"

class TaskType(str, Enum):
    SUBMISSION = "submission"
    PRESENTATION = "presentation"
    QUIZ = "quiz"

# User Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.PARTICIPANT

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    email: str
    full_name: str
    role: UserRole
    created_at: datetime

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    email: str
    full_name: str
    role: UserRole = UserRole.PARTICIPANT
    created_at: datetime
    updated_at: datetime

# Team Models
class TeamMember(BaseModel):
    user_id: str
    user_name: str
    team_role: Optional[TeamMemberRole] = None
    joined_at: datetime = Field(default_factory=datetime.utcnow)

class TeamCreate(BaseModel):
    team_name: str
    competition_id: str

class TeamJoin(BaseModel):
    team_id: str

class AssignRole(BaseModel):
    user_id: str
    team_role: TeamMemberRole

class Team(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    team_name: str
    competition_id: str
    leader_id: str
    members: List[TeamMember] = []
    max_members: int = 5
    status: TeamStatus = TeamStatus.FORMING
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TeamResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    team_name: str
    competition_id: str
    leader_id: str
    members: List[TeamMember]
    max_members: int
    status: TeamStatus
    created_at: datetime

# Competition Models
class CompetitionCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    registration_start: str
    registration_end: str
    competition_start: str
    competition_end: str
    max_teams: int = 8
    status: str = "draft"

class Competition(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = ""
    registration_start: Optional[str] = None
    registration_end: Optional[str] = None
    competition_start: Optional[str] = None
    competition_end: Optional[str] = None
    max_teams: int = 8
    status: str = "draft"
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class CompetitionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    title: str
    description: Optional[str] = ""
    registration_start: Optional[str] = None
    registration_end: Optional[str] = None
    competition_start: Optional[str] = None
    competition_end: Optional[str] = None
    max_teams: int
    status: str
    created_at: Optional[datetime] = None

class CompetitionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    registration_start: Optional[str] = None
    registration_end: Optional[str] = None
    competition_start: Optional[str] = None
    competition_end: Optional[str] = None
    max_teams: Optional[int] = None
    status: Optional[str] = None

# CFO Application Models
class CFOApplicationCreate(BaseModel):
    competition_id: str
    years_experience: int
    job_title: str
    industry: str
    certifications: List[str] = []
    education_level: str
    leadership_answers: dict = {}
    availability_score: int = 5

class CFOApplicationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    user_id: str
    competition_id: str
    cv_file_path: Optional[str] = None
    cv_filename: Optional[str] = None
    years_experience: int
    job_title: Optional[str] = None
    industry: Optional[str] = None
    certifications: List[str] = []
    education_level: Optional[str] = None
    leadership_answers: dict = {}
    auto_score: float = 0
    manual_score: Optional[float] = None
    final_score: float = 0
    availability_score: int = 5
    status: CFOApplicationStatus = CFOApplicationStatus.PENDING
    rejection_reason: Optional[str] = None
    admin_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class CFOApplicationReview(BaseModel):
    status: CFOApplicationStatus
    manual_score: Optional[float] = None
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None

# Task Models
class TaskCreate(BaseModel):
    competition_id: str
    title: str
    description: Optional[str] = None
    task_type: TaskType = TaskType.SUBMISSION
    max_points: int = 100
    deadline: Optional[datetime] = None
    order_index: int = 0

class TaskResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    competition_id: str
    title: str
    description: Optional[str] = None
    task_type: str
    max_points: int
    deadline: Optional[datetime] = None
    order_index: int
    is_active: bool
    created_at: datetime

# Admin Models
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_cfo_qualified: Optional[bool] = None

class AdminUserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    email: str
    full_name: str
    role: UserRole
    is_cfo_qualified: bool = False
    created_at: datetime
    updated_at: datetime

class JudgeAssignment(BaseModel):
    judge_id: str
    competition_id: str

class JudgeAssignmentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    competition_id: str
    judge_id: str
    judge_name: Optional[str] = None
    judge_email: Optional[str] = None
    status: str
    created_at: datetime
