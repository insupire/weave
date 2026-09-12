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
    "note": "라벨·가로 막대·값이 한 줄로 눕고 붙은 말은 맨 앞 라벨 옆에 선다. 자는 subject 전체의 최대값으로 고정한다 — focus 를 옮겨도 길이를 견줄 수 있어야 하기 때문이다",
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
    "id": "playground",
    "kind": "playground",
    "group": "해 보기",
    "title": "플레이그라운드",
    "lead": "템플릿과 값을 고치면 분석뷰가 그 자리에서 바뀐다.",
    "paragraphs": [
      "여기는 JSON 으로 읽히는지만 본다. 스키마 판정은 검사기가 한다 — python -m weave template tpl.json · python -m weave values --template tpl.json values-a.json · python -m weave args args.json",
      "subject 를 더하고 빼는 것은 화면의 동작이다. 더하면 전부 비어 있는 값 한 벌이 생긴다 — subject 마다 값 한 벌이 정확히 하나 있고, 아직 분석하지 않았다는 것도 빈 값과 주석이 말한다."
    ]
  }
];
