terraform {
  required_version = ">= 1.5"

  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.10"
    }
  }

  # 상태는 로컬 파일(terraform.tfstate)에 둔다 — 개인 프로젝트 단독 운용 기준.
  #
  # 트레이드오프: 상태를 잃으면 `terraform import`로 다시 붙이면 되지만(리소스가
  # settings 하나뿐이라 비용이 작다), 여러 기기·CI에서 동시에 apply 하게 되면
  # 잠금이 없어 충돌한다. 그때는 원격 백엔드로 옮길 것.
}
