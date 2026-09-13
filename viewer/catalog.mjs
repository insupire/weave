// schema/ 와 catalog/elements.json 에서 생성된다. 직접 고치지 않는다 — python3 tools/build_viewer.py

export const PAGES = [
  {
    "id": "intro",
    "kind": "guide",
    "group": "시작",
    "title": "weave 란",
    "lead": "분석뷰를 선언하는 스키마와 그것을 그리는 참조 구현이다. 보험을 모른다.",
    "paragraphs": [
      "분석 템플릿 하나에 subject 마다 값 한 벌이 주입되어 분석뷰가 된다. 렌더는 여러 벌을 한 화면에 그리되 나란히 늘어놓지 않고 한 좌표에 겹친다 — 순위를 문장으로 말하지 않는 대신 비교를 시각이 맡기로 한 설계다. 겹칠 수 없는 것(참거짓·글)만 나란히 가른다.",
      "템플릿은 facet 의 배열이고, facet 하나는 primitive element 하나와 그것이 요구하는 필드들이다. 필드 선언에 붙은 설명이 곧 분석에게 주는 추출 지시다. 무엇을 그릴지와 무엇을 찾을지를 한 문서가 함께 말한다.",
      "순위·등급·점수·경고색·확실성 수치를 표현할 문법이 없다. 객관성을 문서가 아니라 스키마로 강제하는 자리다. 문법에 없으므로 나올 수 없다.",
      "왼쪽에서 primitive element 를 하나씩 보고, 플레이그라운드에서 직접 고쳐 가며 화면이 어떻게 되는지 볼 수 있다."
    ]
  },
  {
    "id": "stat",
    "kind": "element",
    "group": "primitive element",
    "title": "stat",
    "compare": "focus",
    "compareSaid": "focus 를 따라 바뀐다",
    "draws": "값 하나를 크게. 고른 subject 의 것을 그린다",
    "blank": "수 하나가 크게 설 자리를 그 크기 그대로 비운다. 필드 이름은 선다. 수가 설 칸과 단위가 서고, 그 위로 빛줄기를 지나가게 하는 것은 뷰어다 — 산출물은 자리만 낸다",
    "note": "겹칠 자리가 없어 focus 가 무엇을 그릴지 고른다. 고른 것이 없으면 첫 subject 다",
    "fields": "1",
    "shapes": [
      "single",
      "range"
    ],
    "types": [
      "number",
      "money",
      "ratio",
      "multiple",
      "duration",
      "age",
      "boolean",
      "text",
      "date"
    ],
    "everyType": true,
    "demo": {
      "template": {
        "weave": "1",
        "id": "demo-stat",
        "title": "stat 보기",
        "facets": [
          {
            "id": "premium",
            "title": "초회 보험료",
            "hint": "이 제안서에서 매달 빠져나가는 금액입니다.",
            "element": "stat",
            "fields": [
              {
                "key": "premium",
                "label": "월 보험료",
                "shape": "single",
                "type": "money",
                "description": "첫 달에 내는 월 보험료 총액을 원 단위 정수로 담는다."
              }
            ],
            "notes": [
              {
                "kind": "tip",
                "text": "카드 하나가 subject 하나입니다."
              }
            ]
          }
        ]
      },
      "values": [
        {
          "weave": "1",
          "templateId": "demo-stat",
          "subjectId": "a",
          "subjectLabel": "가",
          "facets": {
            "premium": {
              "fields": {
                "premium": {
                  "state": "filled",
                  "value": 87400,
                  "notes": [
                    {
                      "kind": "quote",
                      "text": "합계보험료 87,400원"
                    }
                  ]
                }
              }
            }
          }
        },
        {
          "weave": "1",
          "templateId": "demo-stat",
          "subjectId": "b",
          "subjectLabel": "나",
          "facets": {
            "premium": {
              "fields": {
                "premium": {
                  "state": "empty",
                  "notes": [
                    {
                      "kind": "caution",
                      "text": "이 제안서에는 보험료가 적혀 있지 않습니다."
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    }
  },
  {
    "id": "facts",
    "kind": "element",
    "group": "primitive element",
    "title": "facts",
    "compare": "focus",
    "compareSaid": "focus 를 따라 바뀐다",
    "draws": "라벨과 값 여럿. 고른 subject 의 것을 그린다",
    "blank": "선언한 줄이 전부 선다. 이름 옆마다 값이 올 자리를 비운다. 줄마다 값의 생김새(수 칸이냐 글줄이냐)를 따르고, 그 위로 빛줄기를 지나가게 하는 것은 뷰어다 — 산출물은 자리만 낸다",
    "note": "한 facet 에 금액·나이·참거짓·글이 섞여도 읽는 규칙은 하나다. 표는 따로 없다 — 계약사항표 한 장도 이것 하나로 짠다",
    "fields": "1–12",
    "shapes": [
      "single",
      "range"
    ],
    "types": [
      "number",
      "money",
      "ratio",
      "multiple",
      "duration",
      "age",
      "boolean",
      "text",
      "date"
    ],
    "everyType": true,
    "demo": {
      "template": {
        "weave": "1",
        "id": "demo-facts",
        "title": "facts 보기",
        "facets": [
          {
            "id": "terms",
            "title": "계약 조건",
            "hint": "누구와 언제까지 어떤 방식으로 맺는 계약인지입니다.",
            "element": "facts",
            "fields": [
              {
                "key": "payment-period",
                "label": "납입기간",
                "shape": "single",
                "type": "duration",
                "description": "보험료를 내는 총 기간을 개월로 담는다. 20년납이면 240."
              },
              {
                "key": "renews",
                "label": "갱신 여부",
                "shape": "single",
                "type": "boolean",
                "description": "갱신형이면 참, 비갱신형이면 거짓으로 담는다."
              },
              {
                "key": "entry-age",
                "label": "가입나이",
                "shape": "range",
                "type": "age",
                "description": "가입할 수 있는 나이 구간을 세로 담는다. 한쪽만 알아도 된다."
              }
            ],
            "notes": [
              {
                "kind": "note",
                "text": "행이 항목이고 열이 subject 입니다."
              }
            ]
          }
        ]
      },
      "values": [
        {
          "weave": "1",
          "templateId": "demo-facts",
          "subjectId": "a",
          "subjectLabel": "가",
          "facets": {
            "terms": {
              "fields": {
                "payment-period": {
                  "state": "filled",
                  "value": 240
                },
                "renews": {
                  "state": "filled",
                  "value": false
                },
                "entry-age": {
                  "state": "filled",
                  "value": {
                    "min": 15,
                    "max": 65
                  }
                }
              }
            }
          }
        },
        {
          "weave": "1",
          "templateId": "demo-facts",
          "subjectId": "b",
          "subjectLabel": "나",
          "facets": {
            "terms": {
              "fields": {
                "payment-period": {
                  "state": "filled",
                  "value": 120
                },
                "renews": {
                  "state": "filled",
                  "value": true
                },
                "entry-age": {
                  "state": "empty",
                  "notes": [
                    {
                      "kind": "caution",
                      "text": "표가 잘려 읽지 못했습니다."
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    }
  },
  {
    "id": "bars",
    "kind": "element",
    "group": "primitive element",
    "title": "bars",
    "compare": "focus",
    "compareSaid": "focus 를 따라 바뀐다",
    "draws": "크기 비교. 고른 subject 의 막대를 그린다",
    "blank": "필드마다 빈 자가 선다. 길이 0 의 막대가 아니라 채우지 않은 자다. 자마다 빛줄기가 지나갈 표식이 서고, 그것을 움직이는 것은 뷰어다 — 산출물은 자리만 낸다",
    "note": "라벨·가로 막대·값이 한 줄로 눕고 붙은 말은 맨 앞 라벨 옆에 선다. 자는 facet 하나에 하나다 — 모든 필드·subject·고를 것을 덮으므로 무엇을 눌러도 자가 안 움직이고 한 facet 안의 막대끼리 길이를 견줄 수 있다. 범위가 크게 다른 필드를 한 facet 에 섞으면 작은 것이 짧아지는데, 그것이 축이 둘이라는 신호다",
    "fields": "1–6",
    "shapes": [
      "single"
    ],
    "types": [
      "number",
      "money",
      "ratio",
      "multiple",
      "duration",
      "age"
    ],
    "everyType": false,
    "demo": {
      "template": {
        "weave": "1",
        "id": "demo-bars",
        "title": "bars 보기",
        "facets": [
          {
            "id": "amounts",
            "title": "주요 가입금액",
            "hint": "주요 담보의 가입금액입니다.",
            "element": "bars",
            "fields": [
              {
                "key": "death",
                "label": "일반사망",
                "shape": "single",
                "type": "money",
                "description": "일반사망 보험금 가입금액을 원 단위 정수로 담는다."
              },
              {
                "key": "cancer",
                "label": "암진단비",
                "shape": "single",
                "type": "money",
                "description": "일반암 진단비 가입금액을 원 단위 정수로 담는다."
              }
            ],
            "notes": [
              {
                "kind": "caution",
                "text": "가입금액은 최대 금액이고 지급 조건은 약관이 정합니다."
              }
            ]
          }
        ]
      },
      "values": [
        {
          "weave": "1",
          "templateId": "demo-bars",
          "subjectId": "a",
          "subjectLabel": "가",
          "facets": {
            "amounts": {
              "fields": {
                "death": {
                  "state": "filled",
                  "value": 50000000
                },
                "cancer": {
                  "state": "filled",
                  "value": 30000000
                }
              }
            }
          }
        },
        {
          "weave": "1",
          "templateId": "demo-bars",
          "subjectId": "b",
          "subjectLabel": "나",
          "facets": {
            "amounts": {
              "fields": {
                "death": {
                  "state": "empty",
                  "notes": [
                    {
                      "kind": "note",
                      "text": "사망보장이 들어 있지 않습니다."
                    }
                  ]
                },
                "cancer": {
                  "state": "filled",
                  "value": 50000000
                }
              }
            }
          }
        }
      ]
    }
  },
  {
    "id": "line",
    "kind": "element",
    "group": "primitive element",
    "title": "line",
    "compare": "overlay",
    "compareSaid": "겹친다",
    "draws": "축 위의 변화. subject 마다 선 하나가 한 좌표에 겹친다",
    "blank": "두 축과 그림이 들어올 면만 선다. 값이 없으면 눈금도 없고 꺾은선도 없다 — 눈금을 지어내면 그것이 가짜 값이고, 고정된 꺾은선 하나는 눈금이 없어도 추세로 읽힌다. 그 면 위로 빛줄기를 지나가게 하는 것은 뷰어다 — 산출물은 자리만 낸다",
    "note": "축이 둘이라 선끼리 갈린다. 누가 누구인지는 선 끝의 이름이 말해 아래에 범례를 두지 않고, 무엇을 보는 중인지는 지금·직전·나머지 세 갈래의 색과 굵기가 말한다. 고른 subject 가 선을 못 세웠을 때만 축 아래가 그 사실을 적는다. 가로축은 age·date·duration·number 만 된다",
    "fields": "1",
    "shapes": [
      "series"
    ],
    "types": [
      "number",
      "money",
      "ratio",
      "multiple",
      "duration",
      "age"
    ],
    "everyType": false,
    "demo": {
      "template": {
        "weave": "1",
        "id": "demo-line",
        "title": "line 보기",
        "facets": [
          {
            "id": "curve",
            "title": "나이별 예상 보험료",
            "hint": "나이가 들며 보험료가 어떻게 달라지는지입니다.",
            "element": "line",
            "fields": [
              {
                "key": "premium-curve",
                "label": "월 보험료",
                "shape": "series",
                "type": "money",
                "axis": "age",
                "description": "갱신 예시표에 적힌 나이별 월 보험료를 나이와 금액의 점들로 담는다."
              }
            ],
            "notes": [
              {
                "kind": "caution",
                "text": "예시표의 금액은 예상치입니다."
              }
            ]
          }
        ]
      },
      "values": [
        {
          "weave": "1",
          "templateId": "demo-line",
          "subjectId": "a",
          "subjectLabel": "가",
          "facets": {
            "curve": {
              "fields": {
                "premium-curve": {
                  "state": "filled",
                  "value": [
                    {
                      "at": 40,
                      "value": 41200
                    },
                    {
                      "at": 50,
                      "value": 62800
                    },
                    {
                      "at": 60,
                      "value": 104500
                    }
                  ]
                }
              }
            }
          }
        },
        {
          "weave": "1",
          "templateId": "demo-line",
          "subjectId": "b",
          "subjectLabel": "나",
          "facets": {
            "curve": {
              "fields": {
                "premium-curve": {
                  "state": "filled",
                  "value": [
                    {
                      "at": 40,
                      "value": 33500
                    },
                    {
                      "at": 50,
                      "value": 55900
                    },
                    {
                      "at": 60,
                      "value": 99800
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    }
  },
  {
    "id": "list",
    "kind": "element",
    "group": "primitive element",
    "title": "list",
    "compare": "overlay",
    "compareSaid": "겹친다",
    "draws": "반복되는 항목을 하나로 합친다. 같은 항목이 한 줄에 서고 subject 가 그 줄에서 갈린다",
    "blank": "키 열이 서고 그 옆 한 칸이 subject 가 올 자리로 비어 있는다. 열은 subject 가 만든다. 열 머리와 칸이 값의 생김새를 따르고, 그 위로 빛줄기를 지나가게 하는 것은 뷰어다 — 산출물은 자리만 낸다",
    "note": "누가 그 항목을 갖고 누가 안 갖는지가 한 줄에서 읽힌다. 겹치지 않고 고른 것만 펴려면 rows 다. 목록을 못 읽어 모르는 것은 표기(—)로, 읽었고 그 항목이 없다는 아는 사실은 글(없음)로 선다",
    "fields": "1",
    "shapes": [
      "items"
    ],
    "types": [
      "number",
      "money",
      "ratio",
      "multiple",
      "duration",
      "age",
      "boolean",
      "text",
      "date"
    ],
    "everyType": true,
    "demo": {
      "template": {
        "weave": "1",
        "id": "demo-list",
        "title": "list 보기",
        "facets": [
          {
            "id": "riders",
            "title": "특약",
            "hint": "제안서마다 어떤 특약을 넣었는지 나란히 둔 것입니다.",
            "element": "list",
            "fields": [
              {
                "key": "rider-list",
                "label": "특약 목록",
                "shape": "items",
                "description": "보장내역 표에 적힌 특약을 하나씩 담는다. 주계약은 뺀다.",
                "columns": [
                  {
                    "key": "name",
                    "label": "특약명",
                    "type": "text",
                    "description": "설계안에 적힌 이름 그대로 담는다."
                  },
                  {
                    "key": "amount",
                    "label": "가입금액",
                    "type": "money",
                    "description": "그 특약의 가입금액을 원 단위 정수로 담는다."
                  },
                  {
                    "key": "renews",
                    "label": "갱신",
                    "type": "boolean",
                    "description": "그 특약이 갱신형이면 참으로 담는다."
                  }
                ]
              }
            ],
            "notes": [
              {
                "kind": "tip",
                "text": "채우지 않은 열은 빈 칸입니다."
              }
            ]
          }
        ]
      },
      "values": [
        {
          "weave": "1",
          "templateId": "demo-list",
          "subjectId": "a",
          "subjectLabel": "가",
          "facets": {
            "riders": {
              "fields": {
                "rider-list": {
                  "state": "filled",
                  "value": [
                    {
                      "name": "암진단비(유사암제외)",
                      "amount": 30000000,
                      "renews": false
                    },
                    {
                      "name": "질병입원일당",
                      "amount": 30000,
                      "renews": true
                    },
                    {
                      "name": "상해수술비",
                      "amount": 300000
                    }
                  ]
                }
              }
            }
          }
        },
        {
          "weave": "1",
          "templateId": "demo-list",
          "subjectId": "b",
          "subjectLabel": "나",
          "facets": {
            "riders": {
              "fields": {
                "rider-list": {
                  "state": "filled",
                  "value": [],
                  "notes": [
                    {
                      "kind": "tip",
                      "text": "특약 없이 주계약 하나로만 된 설계입니다."
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    }
  },
  {
    "id": "rows",
    "kind": "element",
    "group": "primitive element",
    "title": "rows",
    "compare": "focus",
    "compareSaid": "focus 를 따라 바뀐다",
    "draws": "고른 subject 의 항목을 행으로 편다. 겹치지 않는다",
    "blank": "열 머리가 전부 선다. 열은 템플릿이 선언한 것이라 subject 없이도 안다. 칸마다 그 열의 생김새를 따르고, 그 위로 빛줄기를 지나가게 하는 것은 뷰어다 — 산출물은 자리만 낸다",
    "note": "list 와 같은 값을 받지만 비교하는 법이 다르다 — list 는 여럿을 한 표에 겹치고 rows 는 지금 보고 있는 하나만 편다. 이름만 보고 어느 쪽인지 알 수 있게 갈라 두었다",
    "fields": "1",
    "shapes": [
      "items"
    ],
    "types": [
      "number",
      "money",
      "ratio",
      "multiple",
      "duration",
      "age",
      "boolean",
      "text",
      "date"
    ],
    "everyType": true,
    "demo": {
      "template": {
        "weave": "1",
        "id": "demo-rows",
        "title": "rows 보기",
        "facets": [
          {
            "id": "riders",
            "title": "담보",
            "hint": "고른 제안서에 붙은 담보를 설계안 순서 그대로 편 것입니다.",
            "element": "rows",
            "fields": [
              {
                "key": "rider-list",
                "label": "담보 목록",
                "shape": "items",
                "description": "보장내역 표에 적힌 담보를 적힌 순서 그대로 하나씩 담는다.",
                "columns": [
                  {
                    "key": "name",
                    "label": "담보",
                    "type": "text",
                    "description": "설계안에 적힌 이름 그대로 담는다."
                  },
                  {
                    "key": "amount",
                    "label": "가입금액",
                    "type": "money",
                    "description": "그 담보의 가입금액을 원 단위 정수로 담는다."
                  },
                  {
                    "key": "premium",
                    "label": "월 보험료",
                    "type": "money",
                    "description": "그 담보 몫의 월 보험료를 원 단위 정수로 담는다."
                  }
                ],
                "hint": "설계안에 적힌 순서 그대로예요."
              }
            ],
            "notes": [
              {
                "kind": "note",
                "text": "고른 제안서의 것만 폅니다. 나란히 견주려면 list 를 씁니다."
              }
            ]
          }
        ]
      },
      "values": [
        {
          "weave": "1",
          "templateId": "demo-rows",
          "subjectId": "a",
          "subjectLabel": "가",
          "facets": {
            "riders": {
              "fields": {
                "rider-list": {
                  "state": "filled",
                  "value": [
                    {
                      "name": "암진단비(유사암제외)",
                      "amount": 30000000,
                      "premium": 31200
                    },
                    {
                      "name": "질병입원일당",
                      "amount": 30000,
                      "premium": 4400
                    },
                    {
                      "name": "상해수술비",
                      "amount": 300000
                    }
                  ]
                }
              }
            }
          }
        },
        {
          "weave": "1",
          "templateId": "demo-rows",
          "subjectId": "b",
          "subjectLabel": "나",
          "facets": {
            "riders": {
              "fields": {
                "rider-list": {
                  "state": "empty",
                  "notes": [
                    {
                      "kind": "caution",
                      "text": "보장내역 표가 사진에 담기지 않았습니다."
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    }
  },
  {
    "id": "parts",
    "kind": "element",
    "group": "primitive element",
    "title": "parts",
    "compare": "focus",
    "compareSaid": "focus 를 따라 바뀐다",
    "draws": "하나를 쪼갠 조각들. 합치면 한 덩어리가 된다",
    "blank": "빈 띠가 선다. 조각 이름은 값이 갖고 오는 것이라 지어내지 않는다. 띠 위에 빛줄기가 지나갈 표식이 서고, 그것을 움직이는 것은 뷰어다 — 산출물은 자리만 낸다",
    "note": "bars 와 다르다 — 막대는 서로 다른 것들의 크기를 견주고 여기 조각들은 한 덩어리의 안쪽이다. 한 subject 의 안을 나눈 것이라 겹칠 수 없어 focus 를 따른다. 파이가 아니라 띠로 그린다: 색으로 가르지 않으므로 조각마다 이름을 옆에 세울 수 있는 쪽이 읽힌다. 둘째 열이 몫이라 수치형이어야 한다",
    "fields": "1",
    "shapes": [
      "items"
    ],
    "types": [
      "number",
      "money",
      "ratio",
      "multiple",
      "duration",
      "age",
      "boolean",
      "text",
      "date"
    ],
    "everyType": true,
    "demo": {
      "template": {
        "weave": "1",
        "id": "demo-parts",
        "title": "parts 보기",
        "facets": [
          {
            "id": "split",
            "title": "보험료가 어디로 가나",
            "hint": "월 보험료를 주계약과 특약별 몫으로 쪼갠 것입니다.",
            "element": "parts",
            "fields": [
              {
                "key": "share",
                "label": "몫",
                "shape": "items",
                "hint": "월 보험료를 쪼갠 것이에요.",
                "description": "월 보험료를 주계약과 특약으로 쪼개 각 몫을 원 단위 정수로 담는다.",
                "columns": [
                  {
                    "key": "part",
                    "label": "어디",
                    "type": "text",
                    "description": "그 몫이 가는 곳의 이름 그대로 담는다."
                  },
                  {
                    "key": "amount",
                    "label": "몫",
                    "type": "money",
                    "description": "그 몫의 월 보험료를 원 단위 정수로 담는다."
                  }
                ]
              }
            ],
            "notes": [
              {
                "kind": "note",
                "text": "조각의 차례는 설계안에 적힌 차례입니다. 크기 순서가 아닙니다."
              }
            ]
          }
        ]
      },
      "values": [
        {
          "weave": "1",
          "templateId": "demo-parts",
          "subjectId": "a",
          "subjectLabel": "가",
          "facets": {
            "split": {
              "fields": {
                "share": {
                  "state": "filled",
                  "value": [
                    {
                      "part": "주계약",
                      "amount": 7400
                    },
                    {
                      "part": "암 특약",
                      "amount": 31200
                    },
                    {
                      "part": "뇌혈관 특약",
                      "amount": 14600
                    },
                    {
                      "part": "그 밖",
                      "amount": 4200
                    }
                  ]
                }
              }
            }
          }
        },
        {
          "weave": "1",
          "templateId": "demo-parts",
          "subjectId": "b",
          "subjectLabel": "나",
          "facets": {
            "split": {
              "fields": {
                "share": {
                  "state": "empty",
                  "notes": [
                    {
                      "kind": "caution",
                      "text": "담보별 보험료가 적혀 있지 않습니다."
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    }
  },
  {
    "id": "playground",
    "kind": "playground",
    "group": "플레이그라운드",
    "title": "플레이그라운드",
    "lead": "템플릿과 값을 고치면 분석뷰가 그 자리에서 바뀐다.",
    "paragraphs": [
      "여기는 JSON 으로 읽히는지만 본다. 스키마 판정은 검사기가 한다 — python -m weave template tpl.json · python -m weave values --template tpl.json values-a.json · python -m weave args args.json",
      "subject 를 더하고 빼는 것은 화면의 동작이다. 더하면 전부 비어 있는 값 한 벌이 생긴다 — subject 마다 값 한 벌이 정확히 하나 있고, 아직 분석하지 않았다는 것도 빈 값과 주석이 말한다."
    ]
  }
];
