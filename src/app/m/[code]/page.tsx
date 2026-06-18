"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRepository } from "@/lib/repositories";
import { setActiveShopId } from "@/lib/activeShop";
import { setMemberShopId } from "@/lib/memberSession";

// 회원 초대 링크: /m/<가입코드>
// 코드로 샵을 찾아 선택하고 /m 으로 보냄(코드 직접 입력 없이 링크 클릭만).
export default function ShopLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      const shop = await getRepository().findShopByCode(code);
      if (!shop) {
        setError(true);
        return;
      }
      setMemberShopId(shop.id);
      setActiveShopId(shop.id);
      router.replace("/m");
    })();
  }, [code, router]);

  if (error) {
    return (
      <div className="pt-16 text-center">
        <p className="text-[14px] font-semibold text-canceled">
          유효하지 않은 초대 링크입니다.
        </p>
        <Link
          href="/m"
          className="mt-3 inline-block text-[13px] font-semibold text-clay"
        >
          코드 직접 입력하기
        </Link>
      </div>
    );
  }
  return <p className="pt-16 text-center text-faint">샵을 찾는 중…</p>;
}
